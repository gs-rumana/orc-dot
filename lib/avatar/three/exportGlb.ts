import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { restorePose } from "./buildAvatar";

/** Bake instanced fur into a portable mesh; the live preview stays instanced. */
export async function avatarToGlb(source: THREE.Group): Promise<ArrayBuffer> {
  const avatar = source.clone(true);
  avatar.position.set(0, 0, 0);
  avatar.rotation.set(0, 0, 0);
  avatar.scale.setScalar(1);
  const allocatedGeometries: THREE.BufferGeometry[] = [];
  const allocatedMaterials: THREE.Material[] = [];
  const instances: THREE.InstancedMesh[] = [];
  avatar.traverse((object) => {
    restorePose(object);
    if (object instanceof THREE.InstancedMesh) instances.push(object);
  });
  try {
    for (const object of instances) {
      const parts: THREE.BufferGeometry[] = [];
      const matrix = new THREE.Matrix4();
      const color = new THREE.Color();
      for (let i = 0; i < object.count; i++) {
        const geometry = object.geometry.clone();
        allocatedGeometries.push(geometry);
        object.getMatrixAt(i, matrix);
        geometry.applyMatrix4(matrix);
        const count = geometry.getAttribute("position").count;
        const colors = new Float32Array(count * 3);
        if (object.instanceColor) object.getColorAt(i, color);
        else color.set("#ffffff");
        for (let vertex = 0; vertex < count; vertex++)
          color.toArray(colors, vertex * 3);
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        parts.push(geometry);
      }
      const geometry = mergeGeometries(parts);
      if (!geometry) throw new Error("Could not prepare fur for export.");
      geometry.normalizeNormals();
      allocatedGeometries.push(geometry);
      const material = (object.material as THREE.MeshStandardMaterial).clone();
      material.vertexColors = true;
      allocatedMaterials.push(material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = object.name;
      mesh.position.copy(object.position);
      mesh.quaternion.copy(object.quaternion);
      mesh.scale.copy(object.scale);
      object.parent?.add(mesh);
      object.removeFromParent();
    }
    const result = await new GLTFExporter().parseAsync(avatar, {
      binary: true,
    });
    if (!(result instanceof ArrayBuffer))
      throw new Error("GLB export failed. Please try again.");
    return result;
  } finally {
    allocatedGeometries.forEach((geometry) => geometry.dispose());
    allocatedMaterials.forEach((material) => material.dispose());
    // Clone-owned instance buffers, without disposing shared live geometry.
    instances.forEach((object) => object.dispose());
  }
}
