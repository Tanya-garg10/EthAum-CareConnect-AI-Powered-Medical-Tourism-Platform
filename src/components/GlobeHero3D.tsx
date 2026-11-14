import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, Lightformer, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import type { DestinationHub } from '../types';

interface GlobeHero3DProps {
  hubs: DestinationHub[];
  selectedHubId: string;
  onSelectHub: (hub: DestinationHub) => void;
}

// Module-scope reusable math objects for zero-GC animation loop
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _upVec = new THREE.Vector3(0, 1, 0);

const GLOBE_RADIUS = 1.66;
const INITIAL_ROT_Y = -1.95;
const INITIAL_ROT_X = 0.18;

function latLonToVector3(lat: number, lon: number, radius: number, target = new THREE.Vector3()): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return target.set(x, y, z);
}

function createProceduralEarthTextures(): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 1024;
  roughCanvas.height = 512;
  const rctx = roughCanvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#09152E');
  grad.addColorStop(0.5, '#070E20');
  grad.addColorStop(1, '#09152E');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Smooth ocean vs matte landmasses in roughness map
  rctx.fillStyle = '#484848';
  rctx.fillRect(0, 0, roughCanvas.width, roughCanvas.height);

  ctx.strokeStyle = 'rgba(57, 221, 245, 0.09)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  const continents: Array<Array<[number, number]>> = [
    [[-165, 65], [-130, 70], [-95, 70], [-60, 50], [-75, 35], [-82, 25], [-98, 18], [-105, 22], [-122, 38], [-135, 55]],
    [[-80, 10], [-60, 10], [-36, -6], [-40, -22], [-58, -38], [-68, -54], [-75, -42], [-80, -5]],
    [[-10, 36], [5, 44], [-5, 52], [10, 58], [28, 70], [42, 65], [40, 44], [25, 38], [12, 40]],
    [[-16, 15], [-6, 35], [32, 31], [42, 12], [50, 10], [40, -14], [28, -33], [16, -33], [12, -12], [8, 4], [-10, 6]],
    [[35, 42], [60, 68], [115, 72], [168, 66], [142, 45], [130, 35], [122, 24], [108, 12], [98, 10], [80, 8], [68, 22], [55, 24], [38, 32]],
    [[114, -22], [130, -12], [146, -16], [153, -28], [146, -38], [132, -34], [116, -34]],
  ];

  const lonToX = (lon: number) => ((lon + 180) / 360) * canvas.width;
  const latToY = (lat: number) => ((90 - lat) / 180) * canvas.height;

  continents.forEach((poly) => {
    ctx.beginPath();
    rctx.beginPath();
    poly.forEach(([lon, lat], i) => {
      const px = lonToX(lon);
      const py = latToY(lat);
      if (i === 0) {
        ctx.moveTo(px, py);
        rctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
        rctx.lineTo(px, py);
      }
    });
    ctx.closePath();
    rctx.closePath();

    ctx.fillStyle = 'rgba(71, 123, 255, 0.28)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(57, 221, 245, 0.5)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    rctx.fillStyle = '#c8c8c8';
    rctx.fill();

    ctx.fillStyle = 'rgba(57, 221, 245, 0.52)';
    for (let x = 0; x < canvas.width; x += 8) {
      for (let y = 0; y < canvas.height; y += 8) {
        if (ctx.isPointInPath(x, y)) {
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      }
    }
  });

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  return { map, roughnessMap };
}

interface HubMarkerProps {
  hub: DestinationHub;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (hub: DestinationHub) => void;
  onHover: (id: string | null) => void;
}

function HubMarker({ hub, isSelected, isHovered, onSelect, onHover }: HubMarkerProps) {
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const { pos, quat } = useMemo(() => {
    const surface = latLonToVector3(hub.lat, hub.lon, GLOBE_RADIUS + 0.008);
    const normal = surface.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(_upVec, normal);
    return { pos: surface, quat: q };
  }, [hub.lat, hub.lon]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const elapsed = state.clock.elapsedTime;
    if (coreRef.current) {
      const targetScale = isSelected ? 1.48 + Math.sin(elapsed * 3.2) * 0.12 : isHovered ? 1.3 : 1.0;
      const next = THREE.MathUtils.damp(coreRef.current.scale.x, targetScale, 8, dt);
      coreRef.current.scale.setScalar(next);
    }
    if (ringRef.current) {
      const targetRing = isSelected ? 1.55 : isHovered ? 1.3 : 1.0;
      _vec3B.setScalar(targetRing);
      ringRef.current.scale.lerp(_vec3B, Math.min(1, dt * 8));
    }
  });

  const activeColor = isSelected ? '#9272FF' : isHovered ? '#72E6FA' : '#39DDF5';

  return (
    <group position={pos} quaternion={quat}>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.14, 8]} />
        <meshBasicMaterial color={activeColor} transparent opacity={0.85} />
      </mesh>
      <mesh
        ref={coreRef}
        position={[0, 0.14, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(hub);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
          onHover(hub.id);
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
          onHover(null);
        }}
      >
        <sphereGeometry args={[0.044, 16, 16]} />
        <meshStandardMaterial
          color={activeColor}
          emissive={activeColor}
          emissiveIntensity={isSelected ? 1.8 : 1.25}
          roughness={0.2}
          metalness={0.4}
        />
      </mesh>
      <mesh ref={ringRef} position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.056, 0.086, 24]} />
        <meshBasicMaterial color={activeColor} side={THREE.DoubleSide} transparent opacity={0.7} />
      </mesh>
      {/* Generous invisible hit proxy for effortless clicking */}
      <mesh
        position={[0, 0.1, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(hub);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
          onHover(hub.id);
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
          onHover(null);
        }}
      >
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {(isHovered || isSelected) && (
        <Html position={[0, 0.25, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }} zIndexRange={[100, 0]}>
          <div key={hub.id} className="whitespace-nowrap rounded-lg border border-[#39DDF5]/40 bg-[#070B18]/95 px-2.5 py-1 text-[11px] font-medium text-white shadow-lg">
            <span className="text-[#39DDF5]">{hub.city}</span> · {hub.country}
          </div>
        </Html>
      )}
    </group>
  );
}

interface GlobeSceneProps {
  hubs: DestinationHub[];
  selectedHubId: string;
  onSelectHub: (hub: DestinationHub) => void;
  reducedMotion: boolean;
  isSoftwareGl: boolean;
}

function GlobeScene({
  hubs,
  selectedHubId,
  onSelectHub,
  reducedMotion,
  isSoftwareGl,
}: GlobeSceneProps) {
  const { camera, pointer } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const globeGroupRef = useRef<THREE.Group>(null);
  const hologramGroupRef = useRef<THREE.Group>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.Group>(null);
  const starFieldRef = useRef<THREE.Points>(null);
  const packetsRef = useRef<THREE.InstancedMesh>(null);

  const [hoveredHubId, setHoveredHubId] = useState<string | null>(null);
  const isUserInteractingRef = useRef(false);
  const flyToActiveRef = useRef(false);
  const prevSelectedRef = useRef<string>(selectedHubId);

  const { map, roughnessMap } = useMemo(() => createProceduralEarthTextures(), []);

  useEffect(() => {
    return () => {
      map.dispose();
      roughnessMap.dispose();
    };
  }, [map, roughnessMap]);

  // Trigger camera glide when user picks a destination card or button
  useEffect(() => {
    if (prevSelectedRef.current !== selectedHubId) {
      prevSelectedRef.current = selectedHubId;
      flyToActiveRef.current = true;
    }
  }, [selectedHubId]);

  const atmoUniforms = useMemo(() => ({ glowColor: { value: new THREE.Color('#39DDF5') } }), []);

  // 7 Great-Circle Corridors connecting global hubs (including Dubai/UAE)
  const { curves, tubeGeometries } = useMemo(() => {
    const corridorRoutes: Array<[number, number, number, number]> = [
      [51.5, -0.12, 1.3521, 103.8198],   // London -> Singapore
      [25.2048, 55.2708, 28.6139, 77.209], // Dubai -> New Delhi
      [51.5, -0.12, 48.1351, 11.582],   // London -> Munich
      [25.2048, 55.2708, 41.0082, 28.9784], // Dubai -> Istanbul
      [-33.86, 151.2, 13.7563, 100.5018], // Sydney -> Bangkok
      [35.67, 139.65, 37.5665, 126.978], // Tokyo -> Seoul
      [48.1351, 11.582, 1.3521, 103.8198], // Munich -> Singapore
    ];

    const builtCurves: THREE.QuadraticBezierCurve3[] = [];
    const geos: THREE.TubeGeometry[] = [];
    corridorRoutes.forEach(([lat1, lon1, lat2, lon2]) => {
      const start = latLonToVector3(lat1, lon1, GLOBE_RADIUS + 0.01);
      const end = latLonToVector3(lat2, lon2, GLOBE_RADIUS + 0.01);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      const dist = start.distanceTo(end);
      mid.normalize().multiplyScalar(GLOBE_RADIUS + 0.25 + dist * 0.22);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      builtCurves.push(curve);
      geos.push(new THREE.TubeGeometry(curve, 36, 0.007, 6, false));
    });
    return { curves: builtCurves, tubeGeometries: geos };
  }, []);

  useEffect(() => {
    return () => {
      tubeGeometries.forEach((g) => g.dispose());
    };
  }, [tubeGeometries]);

  const starPositions = useMemo(() => {
    const count = 300;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2.45 + ((i * 73) % 100) * 0.023;
      const theta = ((i * 137.5) % 360) * (Math.PI / 180);
      const phi = Math.acos(2 * (((i * 29) % 100) / 100) - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  const packetCount = curves.length * 2;

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const elapsed = state.clock.elapsedTime;

    if (!reducedMotion && globeGroupRef.current && !isUserInteractingRef.current && !flyToActiveRef.current) {
      globeGroupRef.current.rotation.y += dt * 0.095;
    }

    if (!reducedMotion && hologramGroupRef.current && !isUserInteractingRef.current) {
      hologramGroupRef.current.rotation.y = THREE.MathUtils.damp(
        hologramGroupRef.current.rotation.y,
        pointer.x * 0.2,
        4,
        dt,
      );
      hologramGroupRef.current.rotation.x = THREE.MathUtils.damp(
        hologramGroupRef.current.rotation.x,
        -pointer.y * 0.14,
        4,
        dt,
      );
    }

    if (!reducedMotion) {
      if (outerRingRef.current) outerRingRef.current.rotation.z += dt * 0.08;
      if (innerRingRef.current) innerRingRef.current.rotation.y -= dt * 0.11;
      if (beaconRef.current) {
        beaconRef.current.rotation.y += dt * 0.65;
        beaconRef.current.position.y = 1.05 + Math.sin(elapsed * 1.4) * 0.08;
      }
      if (starFieldRef.current) starFieldRef.current.rotation.y += dt * 0.02;

      if (packetsRef.current) {
        for (let i = 0; i < packetCount; i++) {
          const curve = curves[i % curves.length];
          const offset = i >= curves.length ? 0.5 : 0;
          const t = (elapsed * 0.24 + offset + (i % curves.length) * 0.13) % 1;
          curve.getPoint(t, _vec3A);
          _mat4.compose(_vec3A, _quat, _scale);
          packetsRef.current.setMatrixAt(i, _mat4);
        }
        packetsRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    // Smooth camera fly-to selected hub in world space, cancelling if user starts dragging
    if (flyToActiveRef.current && globeGroupRef.current && !isUserInteractingRef.current) {
      const targetHub = hubs.find((h) => h.id === selectedHubId);
      if (targetHub) {
        latLonToVector3(targetHub.lat, targetHub.lon, 1, _vec3A);
        _vec3A.applyEuler(globeGroupRef.current.rotation).normalize();
        const currentDist = camera.position.length() || 5.4;
        _targetCamPos.copy(_vec3A).multiplyScalar(currentDist);

        camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 4.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y + 0.35, 4.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, 4.5, dt);
        camera.position.normalize().multiplyScalar(currentDist);
        camera.lookAt(0, 0, 0);

        if (camera.position.distanceTo(_targetCamPos) < 0.42) {
          flyToActiveRef.current = false;
        }
      } else {
        flyToActiveRef.current = false;
      }
    }

    controlsRef.current?.update();
  });

  return (
    <>
      <fogExp2 attach="fog" args={['#070B18', 0.032]} />

      {/* Procedural Studio Lighting Environment (zero external HDR fetch) */}
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={2.2} rotation-x={Math.PI / 2} position={[0, 5, -3]} scale={[8, 8, 1]} color="#CBE8FF" />
        <Lightformer intensity={1.8} rotation-y={Math.PI / 2} position={[-5, 1, 2]} scale={[6, 4, 1]} color="#39DDF5" />
        <Lightformer intensity={1.4} rotation-y={-Math.PI / 2} position={[5, -1, 2]} scale={[6, 4, 1]} color="#9272FF" />
      </Environment>

      <hemisphereLight args={['#8ec5ff', '#091022', 0.85]} />
      <directionalLight position={[5, 4, 6]} intensity={1.85} color="#fff1e0" />
      <directionalLight position={[-5, -2, -4]} intensity={2.1} color="#39DDF5" />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={false}
        enableDamping={!isSoftwareGl}
        dampingFactor={0.05}
        rotateSpeed={0.65}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.8}
        onStart={() => {
          isUserInteractingRef.current = true;
          flyToActiveRef.current = false;
        }}
        onEnd={() => {
          isUserInteractingRef.current = false;
        }}
      />

      <group ref={globeGroupRef} rotation={[INITIAL_ROT_X, INITIAL_ROT_Y, 0]}>
        {/* Primary Globe Mesh */}
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
          <meshPhysicalMaterial
            map={map}
            roughnessMap={roughnessMap}
            roughness={0.44}
            metalness={0.18}
            clearcoat={0.35}
            clearcoatRoughness={0.25}
          />
        </mesh>

        {/* Meridian Wireframe Cage */}
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS * 1.006, 24, 18]} />
          <meshBasicMaterial color="#39DDF5" wireframe transparent opacity={0.065} />
        </mesh>

        {/* Fresnel Atmospheric Rim Glow Shell */}
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS * 1.09, 48, 48]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            uniforms={atmoUniforms}
            vertexShader={`
              varying vec3 vNormal;
              varying vec3 vViewPos;
              void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewPos = -mvPosition.xyz;
                gl_Position = projectionMatrix * mvPosition;
              }
            `}
            fragmentShader={`
              uniform vec3 glowColor;
              varying vec3 vNormal;
              varying vec3 vViewPos;
              void main() {
                float intensity = pow(0.62 - dot(vNormal, normalize(vViewPos)), 3.2);
                gl_FragColor = vec4(glowColor, clamp(intensity * 0.85, 0.0, 0.78));
              }
            `}
          />
        </mesh>

        {/* Interactive Hub Markers */}
        {hubs.map((hub) => (
          <HubMarker
            key={hub.id}
            hub={hub}
            isSelected={hub.id === selectedHubId}
            isHovered={hub.id === hoveredHubId}
            onSelect={onSelectHub}
            onHover={setHoveredHubId}
          />
        ))}

        {/* Curved Great-Circle Medical Corridors */}
        {tubeGeometries.map((geo, idx) => (
          <mesh key={idx} geometry={geo}>
            <meshBasicMaterial
              color={idx % 2 === 0 ? '#39DDF5' : '#9272FF'}
              transparent
              opacity={0.42}
            />
          </mesh>
        ))}

        {/* Travelling Data Packets */}
        <instancedMesh ref={packetsRef} args={[undefined, undefined, packetCount]} frustumCulled={false}>
          <sphereGeometry args={[0.025, 10, 10]} />
          <meshBasicMaterial color="#ffffff" />
        </instancedMesh>
      </group>

      {/* Hologram Telemetry Rings + Medical Beacon */}
      <group ref={hologramGroupRef}>
        <mesh ref={outerRingRef} rotation={[Math.PI * 0.42, 0.25, 0]}>
          <torusGeometry args={[2.22, 0.012, 12, 120]} />
          <meshStandardMaterial
            color="#39DDF5"
            emissive="#164e63"
            metalness={0.88}
            roughness={0.22}
            transparent
            opacity={0.55}
          />
        </mesh>

        <mesh ref={innerRingRef} rotation={[-Math.PI * 0.34, 0, 0.4]}>
          <torusGeometry args={[2.02, 0.009, 10, 100]} />
          <meshStandardMaterial
            color="#9272FF"
            emissive="#312e81"
            metalness={0.75}
            roughness={0.35}
            transparent
            opacity={0.45}
          />
        </mesh>

        <group ref={beaconRef} position={[1.95, 1.05, 0.45]}>
          <mesh>
            <boxGeometry args={[0.06, 0.19, 0.04]} />
            <meshStandardMaterial color="#39DDF5" emissive="#39DDF5" emissiveIntensity={0.75} metalness={0.65} roughness={0.2} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.19, 0.06, 0.04]} />
            <meshStandardMaterial color="#39DDF5" emissive="#39DDF5" emissiveIntensity={0.75} metalness={0.65} roughness={0.2} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.16, 0.008, 8, 36]} />
            <meshBasicMaterial color="#9272FF" transparent opacity={0.7} />
          </mesh>
        </group>
      </group>

      {/* Floating Particles */}
      <points ref={starFieldRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#39DDF5" size={0.028} transparent opacity={0.52} />
      </points>
    </>
  );
}

export default function GlobeHero3D({ hubs, selectedHubId, onSelectHub }: GlobeHero3DProps) {
  const [webglStatus] = useState<{ unavailable: boolean; isSoftware: boolean }>(() => {
    if (typeof window === 'undefined') return { unavailable: true, isSoftware: false };
    try {
      const testCanvas = document.createElement('canvas');
      const gl2 = testCanvas.getContext('webgl2');
      if (!gl2) return { unavailable: true, isSoftware: false };
      const ext = gl2.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl2.RENDERER;
      const gpu = String(gl2.getParameter(param));
      gl2.getExtension('WEBGL_lose_context')?.loseContext();
      const isSoftware = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      return { unavailable: false, isSoftware };
    } catch {
      return { unavailable: true, isSoftware: false };
    }
  });
  const [contextLost, setContextLost] = useState(false);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  if (webglStatus.unavailable || contextLost) {
    return (
      <div className="relative flex h-full w-full items-center justify-center rounded-2xl border border-[#39DDF5]/20 bg-[#0A1228] p-8">
        <svg viewBox="0 0 400 400" className="h-full max-h-[420px] w-full" aria-label="Global Medical Network Diagram">
          <defs>
            <radialGradient id="globeFallback" cx="50%" cy="45%" r="50%">
              <stop offset="0%" stopColor="#1E3A8A" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#070B18" stopOpacity="0.95" />
            </radialGradient>
          </defs>
          <circle cx="200" cy="200" r="140" fill="url(#globeFallback)" stroke="#39DDF5" strokeOpacity="0.35" strokeWidth="1.5" />
          <ellipse cx="200" cy="200" rx="140" ry="52" fill="none" stroke="#39DDF5" strokeOpacity="0.2" />
          <ellipse cx="200" cy="200" rx="68" ry="140" fill="none" stroke="#39DDF5" strokeOpacity="0.2" />
          <path d="M105 165 Q 200 75 295 180" fill="none" stroke="#39DDF5" strokeWidth="2" strokeDasharray="4 4" />
          <path d="M135 235 Q 210 130 280 140" fill="none" stroke="#9272FF" strokeWidth="2" strokeDasharray="4 4" />
          <circle cx="105" cy="165" r="5" fill="#39DDF5" />
          <circle cx="295" cy="180" r="5" fill="#9272FF" />
          <circle cx="280" cy="140" r="5" fill="#39DDF5" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className="h-full w-full cursor-grab active:cursor-grabbing"
      aria-label="Interactive 3D Global Medical Network Globe"
    >
      <Canvas
        dpr={webglStatus.isSoftware ? 1 : [1, 2]}
        camera={{ position: [0.3, 1.4, 5.4], fov: 40, near: 0.1, far: 100 }}
        gl={{
          antialias: !webglStatus.isSoftware,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setContextLost(true);
          });
        }}
      >
        <GlobeScene
          hubs={hubs}
          selectedHubId={selectedHubId}
          onSelectHub={onSelectHub}
          reducedMotion={prefersReducedMotion}
          isSoftwareGl={webglStatus.isSoftware}
        />
      </Canvas>
    </div>
  );
}
