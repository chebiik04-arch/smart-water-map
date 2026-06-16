import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export function WaterTableTerrain({ snapshot }) {
  const mountRef = useRef(null);

  const terrain = useMemo(() => {
    const depth = snapshot?.groundwaterDepthMeters || 45;
    const severity = snapshot?.severityScore || 40;
    return { depth, severity, waterY: -0.35 - Math.min(depth, 90) / 160 };
  }, [snapshot]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const width = mount.clientWidth || 320;
    const height = mount.clientHeight || 180;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f7f2);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(2.7, 2.1, 3.4);
    camera.lookAt(0, -0.2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1.4);
    light.position.set(3, 4, 3);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    const geometry = new THREE.PlaneGeometry(3.6, 2.4, 36, 24);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      positions.setY(i, Math.sin(x * 2.3) * 0.08 + Math.cos(z * 3.1) * 0.07 + terrain.severity / 900);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();

    const land = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: terrain.severity > 75 ? 0xc07a43 : 0x8ea56f, roughness: 0.9 })
    );
    scene.add(land);

    const water = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.04, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x2f80ed, transparent: true, opacity: 0.48 })
    );
    water.position.y = terrain.waterY;
    scene.add(water);

    const well = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, Math.abs(terrain.waterY) + 0.5, 20),
      new THREE.MeshStandardMaterial({ color: 0x1b4d3e })
    );
    well.position.set(-1.2, terrain.waterY / 2 + 0.05, 0.55);
    scene.add(well);

    let frame;
    function animate() {
      land.rotation.y += 0.0025;
      water.rotation.y = land.rotation.y;
      frame = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frame);
      renderer.dispose();
      geometry.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [terrain]);

  return (
    <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-panel">
      <div ref={mountRef} className="h-44 w-full" />
      <div className="grid grid-cols-2 gap-2 border-t border-black/10 p-3 text-xs">
        <Metric label="Water table" value={`${terrain.depth.toFixed(1)} m`} />
        <Metric label="Severity" value={`${terrain.severity.toFixed(0)}/100`} />
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-black/55">{label}</p>
      <p className="font-semibold text-primary">{value}</p>
    </div>
  );
}
