import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import {
  Layers,
  RotateCw,
  Eye,
  Zap,
  Flame,
  Cpu,
  Maximize2,
  Minimize2,
  Info,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

interface GpuDieCanvas3DProps {
  nodeId?: string;
  temperature?: number;
  utilization?: number;
  powerW?: number;
  isThrottled?: boolean;
  className?: string;
  onSelectComponent?: (compName: string, specs: Record<string, string | number>) => void;
}

export const GpuDieCanvas3D: React.FC<GpuDieCanvas3DProps> = ({
  nodeId = 'NODE-01',
  temperature = 68,
  utilization = 84,
  powerW = 285,
  isThrottled = false,
  className = '',
  onSelectComponent,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [exploded, setExploded] = useState(false);
  const [explodeRatio, setExplodeRatio] = useState(0);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [thermalView, setThermalView] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [selectedPart, setSelectedPart] = useState<string>('Logic Compute Die (SM Cores)');
  const [selectedPartSpecs, setSelectedPartSpecs] = useState<Record<string, string | number>>({
    'Architecture': 'NVIDIA Hopper SXM5',
    'CUDA Cores': '16,896',
    'Tensor Cores': '528 Gen-4',
    'Base Clock': '1,410 MHz',
    'Current Load': `${utilization}%`,
    'TDP Limit': `${powerW} W`,
  });

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Layer groups for exploded view animation
  const heatsinkGroupRef = useRef<THREE.Group | null>(null);
  const spreaderGroupRef = useRef<THREE.Group | null>(null);
  const dieGroupRef = useRef<THREE.Group | null>(null);
  const hbmGroupRef = useRef<THREE.Group | null>(null);
  const pcbGroupRef = useRef<THREE.Group | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);

  // Handle Explode Toggle
  const toggleExplode = () => {
    setExploded(!exploded);
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a0a0a);
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.04);

    // 2. Camera Setup
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(7, 5.5, 8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const greenKeyLight = new THREE.DirectionalLight(0x00ff41, 2.4);
    greenKeyLight.position.set(5, 8, 5);
    greenKeyLight.castShadow = true;
    scene.add(greenKeyLight);

    const cyanFillLight = new THREE.DirectionalLight(0x00e5ff, 1.2);
    cyanFillLight.position.set(-6, 4, -4);
    scene.add(cyanFillLight);

    const bottomGlowLight = new THREE.PointLight(0x00ff41, 1.5, 10);
    bottomGlowLight.position.set(0, -2, 0);
    scene.add(bottomGlowLight);

    // Spotlight focusing on the GPU
    const spotLight = new THREE.SpotLight(0xffffff, 8.0);
    spotLight.position.set(0, 10, 0);
    spotLight.angle = Math.PI / 8;
    spotLight.penumbra = 0.5;
    spotLight.decay = 2;
    spotLight.distance = 20;
    spotLight.castShadow = true;
    scene.add(spotLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(16, 24, 0x00ff41, 0x1a2e1a);
    gridHelper.position.y = -2.2;
    scene.add(gridHelper);

    // Master Model Group
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    // -------------------------------------------------------------
    // LAYER 1: BASE SUBSTRATE (PCB + Gold Pins + PCIe Connectors)
    // -------------------------------------------------------------
    const pcbGroup = new THREE.Group();
    pcbGroupRef.current = pcbGroup;
    modelGroup.add(pcbGroup);

    // Dark Circuit Substrate
    const pcbGeo = new THREE.BoxGeometry(5.2, 0.18, 5.2);
    const pcbMat = new THREE.MeshStandardMaterial({
      color: 0x0f180f,
      roughness: 0.4,
      metalness: 0.8,
    });
    const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat);
    pcbMesh.receiveShadow = true;
    pcbMesh.name = 'Substrate (SXM5 Interposer)';
    pcbGroup.add(pcbMesh);

    // Golden Edge Contact Fingers
    const goldContactMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.95,
      roughness: 0.2,
      emissive: 0x554400,
      emissiveIntensity: 0.2,
    });
    const contactBar1 = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.08, 0.3), goldContactMat);
    contactBar1.position.set(0, -0.06, 2.45);
    pcbGroup.add(contactBar1);

    const contactBar2 = contactBar1.clone();
    contactBar2.position.set(0, -0.06, -2.45);
    pcbGroup.add(contactBar2);

    // Surface capacitors & power VRMs
    const capGeo = new THREE.BoxGeometry(0.2, 0.14, 0.35);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.3 });
    for (let x = -2.1; x <= 2.1; x += 0.6) {
      const cap1 = new THREE.Mesh(capGeo, capMat);
      cap1.position.set(x, 0.14, 2.0);
      pcbGroup.add(cap1);

      const cap2 = new THREE.Mesh(capGeo, capMat);
      cap2.position.set(x, 0.14, -2.0);
      pcbGroup.add(cap2);
    }

    // -------------------------------------------------------------
    // LAYER 2: SILICON INTERPOSER & COMPUTE LOGIC DIE
    // -------------------------------------------------------------
    const dieGroup = new THREE.Group();
    dieGroupRef.current = dieGroup;
    modelGroup.add(dieGroup);

    // Silicon Base Interposer
    const interposerGeo = new THREE.BoxGeometry(3.6, 0.12, 3.6);
    const interposerMat = new THREE.MeshStandardMaterial({
      color: 0x151515,
      metalness: 0.9,
      roughness: 0.1,
    });
    const interposer = new THREE.Mesh(interposerGeo, interposerMat);
    interposer.position.y = 0.15;
    interposer.name = 'Silicon TSV Interposer';
    dieGroup.add(interposer);

    // Primary GPU Compute Die (Center logic monolith)
    const computeDieGeo = new THREE.BoxGeometry(1.9, 0.16, 1.9);
    const computeDieMat = new THREE.MeshStandardMaterial({
      color: 0x050505,
      metalness: 0.95,
      roughness: 0.05,
      emissive: 0x00ff41,
      emissiveIntensity: 0.45,
    });
    const computeDie = new THREE.Mesh(computeDieGeo, computeDieMat);
    computeDie.position.y = 0.28;
    computeDie.castShadow = true;
    computeDie.name = 'Logic Compute Die (SM Cores)';
    dieGroup.add(computeDie);

    // Die Micro-grid laser etched lines
    const dieWireGeo = new THREE.WireframeGeometry(computeDieGeo);
    const dieWireMat = new THREE.LineBasicMaterial({ color: 0x00ff41, transparent: true, opacity: 0.6 });
    const dieWire = new THREE.LineSegments(dieWireGeo, dieWireMat);
    dieWire.position.y = 0.28;
    dieGroup.add(dieWire);

    // -------------------------------------------------------------
    // LAYER 3: 6x HBM3 3D-STACKED MEMORY MODULES
    // -------------------------------------------------------------
    const hbmGroup = new THREE.Group();
    hbmGroupRef.current = hbmGroup;
    modelGroup.add(hbmGroup);

    const hbmMat = new THREE.MeshStandardMaterial({
      color: 0x111811,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.35,
    });
    const hbmGeo = new THREE.BoxGeometry(0.55, 0.22, 0.75);

    const hbmPositions = [
      [-1.35, 0.3, -0.65],
      [-1.35, 0.3, 0.65],
      [1.35, 0.3, -0.65],
      [1.35, 0.3, 0.65],
      [0, 0.3, -1.35],
      [0, 0.3, 1.35],
    ];

    hbmPositions.forEach((pos, idx) => {
      const hbm = new THREE.Mesh(hbmGeo, hbmMat);
      hbm.position.set(pos[0], pos[1], pos[2]);
      if (idx >= 4) hbm.rotation.y = Math.PI / 2;
      hbm.castShadow = true;
      hbm.name = `HBM3 High-Bandwidth Stack #${idx + 1} (16GB)`;
      hbmGroup.add(hbm);
    });

    // -------------------------------------------------------------
    // LAYER 4: INTEGRATED HEAT SPREADER (IHS) & VAPOR CHAMBER
    // -------------------------------------------------------------
    const spreaderGroup = new THREE.Group();
    spreaderGroupRef.current = spreaderGroup;
    modelGroup.add(spreaderGroup);

    const spreaderGeo = new THREE.BoxGeometry(4.4, 0.3, 4.4);
    const spreaderMat = new THREE.MeshStandardMaterial({
      color: 0xb87333, // Copper vapor base
      metalness: 0.95,
      roughness: 0.25,
      transparent: true,
      opacity: 0.9,
    });
    const spreader = new THREE.Mesh(spreaderGeo, spreaderMat);
    spreader.position.y = 0.55;
    spreader.castShadow = true;
    spreader.name = 'Vapor Chamber & Copper Heat-Spreader';
    spreaderGroup.add(spreader);

    // Laser logo plate
    const badgeGeo = new THREE.BoxGeometry(2.4, 0.05, 1.2);
    const badgeMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x00ff41,
      emissiveIntensity: 0.2,
    });
    const badge = new THREE.Mesh(badgeGeo, badgeMat);
    badge.position.set(0, 0.72, 0);
    badge.name = 'H100 SXM5 Laser Plaque';
    spreaderGroup.add(badge);

    // -------------------------------------------------------------
    // LAYER 5: DENSE ANODIZED ALUMINUM COOLING FINS
    // -------------------------------------------------------------
    const heatsinkGroup = new THREE.Group();
    heatsinkGroupRef.current = heatsinkGroup;
    modelGroup.add(heatsinkGroup);

    const finMat = new THREE.MeshStandardMaterial({
      color: 0x222822,
      metalness: 0.9,
      roughness: 0.3,
    });

    const finCount = 28;
    for (let i = 0; i < finCount; i++) {
      const zOffset = -2.0 + (i * 4.0) / finCount;
      const finMesh = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 0.04), finMat);
      finMesh.position.set(0, 1.35, zOffset);
      finMesh.castShadow = true;
      heatsinkGroup.add(finMesh);
    }
    heatsinkGroup.name = 'Micro-Fin Heatsink Assembly';

    // -------------------------------------------------------------
    // DATA PACKET PARTICLES (Interconnect Bus Simulation)
    // -------------------------------------------------------------
    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePos[i] = (Math.random() - 0.5) * 4.0;
      particlePos[i + 1] = 0.2 + Math.random() * 0.4;
      particlePos[i + 2] = (Math.random() - 0.5) * 4.0;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00ff41,
      size: 0.08,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    modelGroup.add(particles);
    particlesRef.current = particles;

    // -------------------------------------------------------------
    // MOUSE ORBIT & INTERACTION CONTROLS
    // -------------------------------------------------------------
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let rotationSpeedX = 0;
    let rotationSpeedY = 0;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        rotationSpeedX = deltaX * 0.005;
        rotationSpeedY = deltaY * 0.005;

        modelGroup.rotation.y += rotationSpeedX;
        modelGroup.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, modelGroup.rotation.x + rotationSpeedY));

        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    // Click inspection
    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(modelGroup.children, true);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        let compName = hit.name || 'Silicon Substrate Component';
        if (!hit.name && hit.parent?.name) compName = hit.parent.name;

        setSelectedPart(compName);
        let specs: Record<string, string | number> = {
          Component: compName,
          Node: nodeId,
          Status: 'Active',
        };

        if (compName.includes('Compute Die')) {
          specs = {
            'Architecture': 'Hopper SXM5 4nm Monolith',
            'Compute Cores': '16,896 FP32 CUDA Cores',
            'Tensor Units': '528 4th-Gen Tensor Cores',
            'Current Clock': `${(1100 + utilization * 3.1).toFixed(0)} MHz`,
            'Utilization': `${utilization}%`,
            'Temp Sensor': `${temperature}°C`,
          };
        } else if (compName.includes('HBM3')) {
          specs = {
            'Capacity': '80 GB HBM3 High-Speed VRAM',
            'Bus Width': '5120-bit Interconnect',
            'Bandwidth': '3.35 TB/s Peak Throughput',
            'Stack Architecture': '12-High TSV 3D Silicon',
            'Power Draw': '48 W Active',
          };
        } else if (compName.includes('Vapor') || compName.includes('Heatsink')) {
          specs = {
            'Material': 'Phase-Change Copper + Aluminum',
            'Thermal Dissipation': `${powerW} W TDP Capacity`,
            'Surface Temp': `${temperature - 12}°C`,
            'Chamber Fluid': 'Deionized Vacuum Water',
          };
        } else {
          specs = {
            'Form Factor': 'NVIDIA SXM5 Mezzanine Interface',
            'Interconnect': '900 GB/s NVLink 4.0 (18 Links)',
            'Host Bus': 'PCIe Gen 5.0 x16 (128 GB/s)',
            'Voltage Rails': '12V / 48V Dual-Phase VRM',
          };
        }

        setSelectedPartSpecs(specs);
        if (onSelectComponent) onSelectComponent(compName, specs);
      }
    };

    // Zoom on wheel
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY * 0.003;
      camera.position.z = Math.max(4.5, Math.min(14, camera.position.z + zoomFactor));
      camera.position.y = Math.max(3, Math.min(10, camera.position.y + zoomFactor * 0.7));
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domEl.addEventListener('click', handleClick);
    domEl.addEventListener('wheel', handleWheel, { passive: false });

    // -------------------------------------------------------------
    // ANIMATION TICK LOOP
    // -------------------------------------------------------------
    let currentExplodeY = 0;
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth Exploded View Interpolation
      const targetExplode = exploded ? 1.0 : 0.0;
      currentExplodeY += (targetExplode - currentExplodeY) * 0.08;
      setExplodeRatio(currentExplodeY);

      if (heatsinkGroupRef.current) heatsinkGroupRef.current.position.y = currentExplodeY * 2.8;
      if (spreaderGroupRef.current) spreaderGroupRef.current.position.y = currentExplodeY * 1.5;
      if (hbmGroupRef.current) hbmGroupRef.current.position.y = currentExplodeY * 0.8;
      if (dieGroupRef.current) dieGroupRef.current.position.y = currentExplodeY * 0.4;
      if (pcbGroupRef.current) pcbGroupRef.current.position.y = -currentExplodeY * 0.5;

      // Auto-rotation when not dragging
      if (autoRotate && !isDragging) {
        modelGroup.rotation.y += 0.004;
      }

      // Pulse compute die emission with utilization
      if (computeDieMat) {
        const pulse = 0.35 + Math.sin(elapsed * (2 + utilization * 0.05)) * 0.2;
        computeDieMat.emissiveIntensity = pulse;
      }

      // Animate particle flow through HBM interconnect channels
      if (particlesRef.current) {
        const posAttr = particlesRef.current.geometry.attributes.position;
        const array = posAttr.array as Float32Array;
        for (let i = 0; i < particleCount * 3; i += 3) {
          array[i + 1] += (Math.sin(elapsed * 4 + array[i]) * 0.004);
          if (array[i + 1] > 1.2) array[i + 1] = 0.2;
        }
        posAttr.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      domEl.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domEl.removeEventListener('click', handleClick);
      domEl.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      container.innerHTML = '';
    };
  }, [nodeId]);

  // Update wireframe / thermal material when toggled
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => (m.wireframe = wireframeMode));
          } else {
            child.material.wireframe = wireframeMode;
          }
        }
      }
    });
  }, [wireframeMode]);

  // Update thermal color mapping
  useEffect(() => {
    if (!sceneRef.current) return;
    const tempColor =
      temperature > 80
        ? new THREE.Color(0xff2200) // Critical hot (Crimson)
        : temperature > 65
        ? new THREE.Color(0xffb300) // Moderate hot (Amber)
        : new THREE.Color(0x00ff41); // Nominal (Neon Green)

    sceneRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name.includes('Logic Compute Die')) {
        if (thermalView) {
          child.material.color = tempColor;
          child.material.emissive = tempColor;
          child.material.emissiveIntensity = 0.8;
        } else {
          child.material.color = new THREE.Color(0x050505);
          child.material.emissive = new THREE.Color(0x00ff41);
          child.material.emissiveIntensity = 0.45;
        }
      }
    });
  }, [thermalView, temperature]);

  return (
    <div className={`relative flex flex-col bg-[#0A0A0A] border border-[#1A1A1A] overflow-hidden ${className}`}>
      {/* 3D Viewport Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#111111] border-b border-[#1A1A1A] z-20 font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-neon rounded-none shadow-[0_0_6px_#00FF41] pulse-green-dot" />
          <span className="font-bold text-neon uppercase tracking-wider">
            {nodeId} // INTERACTIVE 3D SILICON ACCELERATOR
          </span>
          <span className="text-[#666] hidden sm:inline">|</span>
          <span className="text-[#A0A0A0] hidden sm:inline">NVIDIA H100 SXM5 80GB</span>
        </div>

        {/* 3D Controls Toolset */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-2.5 py-1 border transition-all flex items-center gap-1 text-[11px] cursor-pointer ${
              autoRotate
                ? 'border-neon bg-[#0D1F0D] text-neon font-bold'
                : 'border-[#222] bg-[#0A0A0A] text-[#888] hover:text-[#e5e2e1]'
            }`}
            title="Toggle Continuous 360° Orbit"
          >
            <RotateCw className="w-3 h-3" />
            <span className="hidden md:inline">ROTATE</span>
          </button>

          <button
            onClick={toggleExplode}
            className={`px-2.5 py-1 border transition-all flex items-center gap-1 text-[11px] cursor-pointer ${
              exploded
                ? 'border-neon bg-neon text-[#0A0A0A] font-bold shadow-[0_0_8px_#00FF41]'
                : 'border-[#222] bg-[#0A0A0A] text-[#888] hover:text-[#e5e2e1]'
            }`}
            title="Explode/Separate Microarchitecture Layers in 3D Space"
          >
            <Layers className="w-3 h-3" />
            <span>EXPLODE LAYERS</span>
          </button>

          <button
            onClick={() => setThermalView(!thermalView)}
            className={`px-2.5 py-1 border transition-all flex items-center gap-1 text-[11px] cursor-pointer ${
              thermalView
                ? 'border-[#FFB300] bg-[#1a1200] text-[#FFB300] font-bold'
                : 'border-[#222] bg-[#0A0A0A] text-[#888] hover:text-[#e5e2e1]'
            }`}
            title="Realtime Thermal Emission Shader"
          >
            <Flame className="w-3 h-3" />
            <span className="hidden sm:inline">THERMAL</span>
          </button>

          <button
            onClick={() => setWireframeMode(!wireframeMode)}
            className={`px-2.5 py-1 border transition-all flex items-center gap-1 text-[11px] cursor-pointer ${
              wireframeMode
                ? 'border-neon bg-[#0D1F0D] text-neon font-bold'
                : 'border-[#222] bg-[#0A0A0A] text-[#888] hover:text-[#e5e2e1]'
            }`}
            title="Holographic Wireframe Mode"
          >
            <Eye className="w-3 h-3" />
            <span className="hidden sm:inline">WIREFRAME</span>
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Mount Point */}
      <div
        ref={mountRef}
        className="w-full h-[420px] md:h-[500px] cursor-grab active:cursor-grabbing relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0d1f0d]/30 via-[#0a0a0a] to-[#050505]"
      />

      {/* Floating HUD Overlays on Top of 3D Canvas */}
      <div className="absolute top-16 left-4 z-20 pointer-events-none font-mono text-[11px] space-y-1.5 bg-[#0A0A0A]/85 backdrop-blur-xs p-3 border border-[#1A1A1A]">
        <div className="text-[#A0A0A0] text-[10px] uppercase border-b border-[#1A1A1A] pb-1 font-bold">
          TELEMETRY TELEPATHY
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#888]">LOAD:</span>
          <span className="text-neon font-bold">{utilization}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#888]">TEMP:</span>
          <span className={`font-bold ${temperature > 75 ? 'text-danger' : temperature > 60 ? 'text-[#FFB300]' : 'text-neon'}`}>
            {temperature}°C
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#888]">POWER:</span>
          <span className="text-[#e5e2e1] font-bold">{powerW} W / 400W</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#888]">NVLINK:</span>
          <span className="text-[#40e56c] font-bold">900 GB/s</span>
        </div>
      </div>

      {/* Interactive Microarchitecture Part Inspector Card */}
      <div className="p-4 bg-[#111111] border-t border-[#1A1A1A] font-mono z-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-neon" />
            <span className="text-xs text-[#e5e2e1] font-bold uppercase tracking-wider">
              INSPECTED COMPONENT: <span className="text-neon">{selectedPart}</span>
            </span>
          </div>
          <span className="text-[10px] text-[#888] italic">
            Click any silicon layer in the 3D model to inspect internal architectural parameters.
          </span>
        </div>

        {/* Spec Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {Object.entries(selectedPartSpecs).map(([key, value]) => (
            <div key={key} className="bg-[#0A0A0A] border border-[#1A1A1A] p-2">
              <div className="text-[10px] text-[#888] uppercase truncate">{key}</div>
              <div className="text-xs text-neon font-bold truncate mt-0.5">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
