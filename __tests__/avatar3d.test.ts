import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  animateAvatar,
  buildAvatar,
  disposeAvatar,
} from "@/lib/avatar/three/buildAvatar";
import { avatarToGlb } from "@/lib/avatar/three/exportGlb";
import { facePatch } from "@/lib/avatar/three/geometry";
import {
  coatColors,
  coatHairColor,
  FUR_COATS,
  FUR_COLORS,
} from "@/lib/avatar/three/types";
import { SKIN_COLORS } from "@/lib/avatar/catalog";
import {
  AVATAR_OPTIONS,
  AVATAR_SHAPES,
  DEFAULT_CONFIG,
} from "@/lib/avatar/types";

describe("3D furry avatars", () => {
  it("uses dense short fibers across the whole orc, with no animal muzzle or ruff", () => {
    const model = buildAvatar(DEFAULT_CONFIG, { color: "lime", coat: "plush" });
    const fur = model.root.getObjectByName("plush fur") as THREE.InstancedMesh;
    expect(fur.count).toBe(46000);
    expect(fur.userData.fiberLength).toBeLessThan(0.04);
    expect(model.root.getObjectByName("Neck ruff")).toBeUndefined();
    expect(model.root.getObjectByName("Muzzle")).toBeUndefined();
    const bounds = new THREE.Box3().setFromObject(
      model.root.getObjectByName("Head")!,
    );
    const eye = model.eyes[0].getObjectByName("Pupil") as THREE.Mesh;
    expect(eye.scale.x).toBeLessThan(
      bounds.getSize(new THREE.Vector3()).x * 0.05,
    );
    disposeAvatar(model.root);
  });

  it("keeps ears in the selected coat color, including skin-matched coats", () => {
    const choices = ["lime", "blue", "yellow", "pink", "skin"] as const;
    for (const color of choices) {
      for (const skin of ["ember", "slate"] as const) {
        const model = buildAvatar(
          { ...DEFAULT_CONFIG, skin },
          { color, coat: "plush" },
        );
        const head = model.root.getObjectByName("Head") as THREE.Mesh<
          THREE.BufferGeometry,
          THREE.MeshStandardMaterial
        >;
        const ears: THREE.Mesh[] = [];
        model.root.traverse((object) => {
          if (object instanceof THREE.Mesh && object.name === "Ear shell")
            ears.push(object);
        });
        expect(ears).toHaveLength(2);
        ears.forEach((ear) =>
          expect(
            (ear.material as THREE.MeshStandardMaterial).color.equals(
              new THREE.Color(head.userData.coatColor),
            ),
          ).toBe(true),
        );
        disposeAvatar(model.root);
      }
    }
  });

  it("uses reflective lenses, moves their gaze, and opens blinks more slowly", () => {
    const model = buildAvatar(DEFAULT_CONFIG, { color: "blue", coat: "plush" });
    const black = model.pupils[0].getObjectByName("Pupil")! as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshPhysicalMaterial
    >;
    expect(black.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(black.material.roughness).toBeLessThan(0.25);
    expect(model.pupils[0].getObjectByName("Catchlight")).toBeUndefined();
    animateAvatar(
      model,
      { ...DEFAULT_CONFIG, motion: "still", eyeMotion: "look-around" },
      0.5,
    );
    expect(model.pupils[0].position.x).not.toBe(0);
    expect(black.parent).toBe(model.pupils[0]);
    const config = {
      ...DEFAULT_CONFIG,
      motion: "still",
      eyeMotion: "blink",
    } as const;
    animateAvatar(model, config, 3.56);
    expect(model.eyes[0].scale.y).toBeCloseTo(0.06);
    animateAvatar(model, config, 3.52);
    const closing = model.eyes[0].scale.y;
    animateAvatar(model, config, 3.608);
    expect(model.eyes[0].scale.y).toBeLessThan(closing);
    animateAvatar(model, config, 3.74);
    expect(model.eyes[0].scale.y).toBe(1);
    disposeAvatar(model.root);
  });

  it("gives almond eyes their own silhouette without adding eyebrows", () => {
    const model = buildAvatar(
      { ...DEFAULT_CONFIG, eyes: "almond", brows: "none" },
      { color: "blue", coat: "plush" },
    );
    model.eyes.forEach((eye) => {
      const lens = eye.getObjectByName("Pupil") as THREE.Mesh;
      expect(lens.scale.x).toBeGreaterThan(lens.scale.y);
      expect(eye.children[0].children).toHaveLength(1);
      expect(eye.getObjectByName("Upper lid")).toBeUndefined();
    });
    expect(model.root.getObjectByName("Brow")).toBeUndefined();
    disposeAvatar(model.root);
  });

  it.each(["angry", "worried"] as const)(
    "puts the inner ends of %s brows in the correct direction",
    (brows) => {
      const model = buildAvatar(
        { ...DEFAULT_CONFIG, brows },
        { color: "blue", coat: "plush" },
      );
      model.root.updateMatrixWorld(true);
      let found = 0;
      model.root.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || object.name !== "Brow root")
          return;
        found++;
        const p = object.geometry.getAttribute("position");
        const a = object.localToWorld(
          new THREE.Vector3().fromBufferAttribute(p, 0),
        );
        const b = object.localToWorld(
          new THREE.Vector3().fromBufferAttribute(p, p.count - 1),
        );
        const [inner, outer] = Math.abs(a.x) < Math.abs(b.x) ? [a, b] : [b, a];
        expect(Math.sign(inner.y - outer.y)).toBe(brows === "angry" ? -1 : 1);
      });
      expect(found).toBe(2);
      disposeAvatar(model.root);
    },
  );

  it("buries tusk roots inside the face while their tips emerge forward", () => {
    const model = buildAvatar(DEFAULT_CONFIG, { color: "blue", coat: "plush" });
    model.root.updateMatrixWorld(true);
    const head = model.root.getObjectByName("Head")!;
    let found = 0;
    model.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object.name !== "Tusk") return;
      found++;
      const ray = new THREE.Raycaster(
        new THREE.Vector3(object.position.x, object.position.y, 2),
        new THREE.Vector3(0, 0, -1),
      );
      const surfaceZ = ray.intersectObject(head)[0].point.z;
      expect(object.position.z).toBeLessThan(surfaceZ - 0.02);
      expect(new THREE.Box3().setFromObject(object).max.z).toBeGreaterThan(
        surfaceZ + 0.03,
      );
    });
    expect(found).toBe(2);
    disposeAvatar(model.root);
  });

  it("snaps the viewer's left tusk into a short stub with a jagged break", () => {
    const model = buildAvatar(
      { ...DEFAULT_CONFIG, tusks: "chipped" },
      { color: "lime", coat: "velvet" },
    );
    const chipped = model.root.getObjectByName("Chipped tusk") as THREE.Mesh;
    const whole = model.root.getObjectByName("Tusk") as THREE.Mesh;
    expect(chipped.position.x).toBeLessThan(0);
    expect(whole.position.x).toBeGreaterThan(0);
    const height = (mesh: THREE.Mesh) => {
      mesh.geometry.computeBoundingBox();
      return mesh.geometry.boundingBox!.max.y;
    };
    expect(height(chipped)).toBeLessThan(height(whole) * 0.8);
    // The fracture rim rises and falls instead of ending in a flat cylinder.
    const p = chipped.geometry.getAttribute("position");
    const rim: number[] = [];
    for (let i = 0; i < p.count; i++)
      if (Math.hypot(p.getX(i), p.getZ(i) - 0.03) > 0.035 && p.getY(i) > 0.12)
        rim.push(p.getY(i));
    expect(Math.max(...rim) - Math.min(...rim)).toBeGreaterThan(0.02);
    disposeAvatar(model.root);
  });

  it("wraps gilded tusks in a thick gold band rather than a thin wire", () => {
    const model = buildAvatar(
      { ...DEFAULT_CONFIG, tusks: "gilded" },
      { color: "lime", coat: "velvet" },
    );
    const bands: THREE.Mesh[] = [];
    model.root.traverse((object) => {
      if (object instanceof THREE.Mesh && object.name === "Gold tusk band")
        bands.push(object);
    });
    expect(bands).toHaveLength(2);
    const size = new THREE.Box3()
      .setFromObject(bands[0])
      .getSize(new THREE.Vector3());
    expect(size.y).toBeGreaterThan(0.05);
    expect(size.x).toBeGreaterThan(0.1);
    disposeAvatar(model.root);
  });

  it("draws mouths from the 2D outlines, raised above the trimmed fur", () => {
    const smile = buildAvatar(DEFAULT_CONFIG, { color: "lime", coat: "plush" });
    const stroke = smile.root.getObjectByName("Smile") as THREE.Mesh;
    const bounds = new THREE.Box3().setFromObject(stroke);
    // As deep as the 2D curve: about a third of its half-width.
    expect(bounds.max.y - bounds.min.y).toBeGreaterThan(0.045);
    disposeAvatar(smile.root);
    for (const mouth of ["grin", "roar"] as const) {
      // Squircles have the coarsest face mesh; the head must never poke through.
      const model = buildAvatar(
        { ...DEFAULT_CONFIG, mouth, shape: "squircle" },
        { color: "lime", coat: "plush" },
      );
      for (const part of ["Mouth cavity", "Mouth rim", "Tongue"])
        expect(model.root.getObjectByName(part)).toBeDefined();
      const head = model.root.getObjectByName("Head")!;
      const cavity = model.root.getObjectByName("Mouth cavity") as THREE.Mesh;
      (cavity.material as THREE.Material).side = THREE.DoubleSide;
      const ray = new THREE.Raycaster();
      let hits = 0;
      for (let x = -0.1; x <= 0.1; x += 0.02)
        for (let y = -0.2; y <= -0.1; y += 0.02) {
          ray.set(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1));
          const inner = ray.intersectObject(cavity)[0];
          if (!inner) continue;
          hits++;
          expect(inner.point.z).toBeGreaterThan(
            ray.intersectObject(head)[0].point.z,
          );
        }
      expect(hits).toBeGreaterThan(20);
      disposeAvatar(model.root);
    }
  });

  it("crowns the orc in gold with a tall centre point, gem and studs", () => {
    const model = buildAvatar(
      { ...DEFAULT_CONFIG, headgear: "spiked-crown" },
      { color: "lime", coat: "velvet" },
    );
    const crown = model.root.getObjectByName("Crown") as THREE.Mesh;
    expect(
      (crown.material as THREE.MeshStandardMaterial).color.getHexString(),
    ).toBe(new THREE.Color("#E8B53E").getHexString());
    const p = crown.geometry.getAttribute("position");
    let front = -Infinity;
    let side = -Infinity;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getX(i)) < 0.02 && p.getZ(i) > 0)
        front = Math.max(front, p.getY(i));
      if (Math.abs(p.getZ(i)) < 0.05 && p.getX(i) > 0)
        side = Math.max(side, p.getY(i));
    }
    expect(front - side).toBeGreaterThan(0.1);
    expect(model.root.getObjectByName("Crown gem")).toBeDefined();
    expect(model.root.getObjectByName("Crown stud")).toBeDefined();
    disposeAvatar(model.root);
  });

  it("wears one coat color, with matching hair following that coat", () => {
    expect(coatColors({ color: "skin", coat: "plush" }, "ember")).toEqual(
      SKIN_COLORS.ember,
    );
    const lime = coatColors({ color: "lime", coat: "plush" }, "ember");
    expect(lime.fill).toBe(FUR_COLORS.lime);
    const config = { ...DEFAULT_CONFIG, hairColor: "match" } as const;
    expect(coatHairColor(config, { color: "lime", coat: "plush" })).toBe(
      lime.fur,
    );
    expect(coatHairColor(config, { color: "skin", coat: "plush" })).toBe(
      SKIN_COLORS[config.skin].fur,
    );
  });

  it("applies warpaint to both skin and fur without an extra decal mesh", () => {
    const options = { color: "blue", coat: "plush" } as const;
    const bare = buildAvatar({ ...DEFAULT_CONFIG, markings: "none" }, options);
    const painted = buildAvatar(
      { ...DEFAULT_CONFIG, markings: "warpaint" },
      options,
    );
    const bareHead = bare.root.getObjectByName("Head") as THREE.Mesh;
    const head = painted.root.getObjectByName("Head") as THREE.Mesh;
    const base = bareHead.geometry.getAttribute("color").array;
    const colors = head.geometry.getAttribute("color").array;
    expect(
      colors.filter((c, i) => Math.abs(c - base[i]) > 0.01).length,
    ).toBeGreaterThan(10);
    const bareFur = bare.root.getObjectByName(
      "plush fur",
    ) as THREE.InstancedMesh;
    const fur = painted.root.getObjectByName(
      "plush fur",
    ) as THREE.InstancedMesh;
    const fibers = fur.instanceColor!.array;
    expect(
      fibers.filter(
        (c, i) => Math.abs(c - bareFur.instanceColor!.array[i]) > 0.01,
      ).length,
    ).toBeGreaterThan(30);
    expect(painted.root.children.length).toBe(bare.root.children.length);
    disposeAvatar(bare.root);
    disposeAvatar(painted.root);
  });

  it("projects patch interiors onto the curved face instead of bridging across it", () => {
    const outline = new THREE.Shape();
    outline.absellipse(0, 0, 0.15, 0.2, 0, Math.PI * 2, false, 0);
    const front = (x: number, y: number) => 1 - x * x - y * y;
    const patch = facePatch(outline, front, 0.01);
    const p = patch.getAttribute("position");
    let interior = false;
    for (let i = 0; i < p.count; i++) {
      expect(p.getZ(i)).toBeCloseTo(front(p.getX(i), p.getY(i)) + 0.01, 6);
      if (Math.hypot(p.getX(i), p.getY(i)) < 0.04) interior = true;
    }
    expect(interior).toBe(true);
    patch.dispose();
  });

  it("anchors a hopping orc's crouch to the floor and settles its accessories", () => {
    const config = {
      ...DEFAULT_CONFIG,
      motion: "hop",
      headgear: "bandana",
      trinket: "earrings",
    } as const;
    const model = buildAvatar(config, { color: "pink", coat: "plush" });
    animateAvatar(model, config, 0.09);
    expect(model.root.scale.y).toBeLessThan(1);
    expect(
      model.root.position.y + model.floor * model.root.scale.y,
    ).toBeCloseTo(model.floor);
    animateAvatar(model, config, 0.5);
    expect(
      model.root.position.y + model.floor * model.root.scale.y,
    ).toBeGreaterThan(model.floor + 0.2);
    const tail = model.root.getObjectByName("Bandana tail")!;
    expect(tail.rotation.z).not.toBe(tail.userData.restRotation[2]);
    animateAvatar(
      model,
      { ...config, motion: "still", eyeMotion: "still" },
      0.5,
    );
    model.parts.forEach(({ object }) => {
      expect(object.position.toArray()).toEqual(object.userData.restPosition);
      expect(object.rotation.toArray().slice(0, 3)).toEqual(
        object.userData.restRotation,
      );
      expect(object.scale.toArray()).toEqual(object.userData.restScale);
    });
    disposeAvatar(model.root);
  });
  it.each(AVATAR_SHAPES)(
    "builds %s in every short coat with finite geometry",
    (shape) => {
      for (const coat of FUR_COATS) {
        const model = buildAvatar(
          { ...DEFAULT_CONFIG, shape },
          { color: "lime", coat },
        );
        expect(model.root.name).toBe("Plush orc");
        expect(model.eyes).toHaveLength(2);
        let strands = 0;
        model.root.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            expect(
              Array.from(object.geometry.getAttribute("position").array).every(
                Number.isFinite,
              ),
            ).toBe(true);
            if (object instanceof THREE.InstancedMesh) {
              strands += object.count;
              expect(
                Array.from(object.instanceMatrix.array).every(Number.isFinite),
              ).toBe(true);
            }
          }
        });
        expect(strands).toBeGreaterThan(6000);
        disposeAvatar(model.root);
      }
    },
  );

  it("assembles every supported face and gear choice", () => {
    for (const field of [
      "shape",
      "brows",
      "mouth",
      "hair",
      "hairColor",
      "beard",
      "skin",
      "ears",
      "eyes",
      "tusks",
      "headgear",
      "markings",
      "trinket",
    ] as const) {
      for (const value of AVATAR_OPTIONS[field]) {
        const model = buildAvatar(
          { ...DEFAULT_CONFIG, [field]: value },
          { color: "blue", coat: "velvet" },
        );
        expect(new THREE.Box3().setFromObject(model.root).isEmpty()).toBe(
          false,
        );
        model.root.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          for (const attribute of ["position", "normal"]) {
            expect(
              object.geometry
                .getAttribute(attribute)
                .array.every(Number.isFinite),
            ).toBe(true);
          }
        });
        disposeAvatar(model.root);
      }
    }
  }, 15000);

  it("resets all animated transforms when motion changes to still", () => {
    const model = buildAvatar(DEFAULT_CONFIG, {
      color: "lime",
      coat: "plush",
    });
    animateAvatar(
      model,
      { ...DEFAULT_CONFIG, motion: "hop", eyeMotion: "look-around" },
      0.5,
    );
    expect(model.root.position.y).toBeGreaterThan(0);
    expect(model.pupils[0].position.x).not.toBe(0);
    animateAvatar(
      model,
      { ...DEFAULT_CONFIG, motion: "still", eyeMotion: "still" },
      0.5,
    );
    expect(model.root.position.y).toBe(0);
    expect(model.root.scale.x).toBe(1);
    expect(model.eyes.every((eye) => eye.scale.y === 1)).toBe(true);
    expect(
      model.pupils.every(
        (pupil) => pupil.position.x === 0 && pupil.position.y === 0,
      ),
    ).toBe(true);
    disposeAvatar(model.root);
  });

  it("disposes shared geometry once and releases fur instance buffers", () => {
    const model = buildAvatar(DEFAULT_CONFIG, {
      color: "pink",
      coat: "velvet",
    });
    const head = model.root.getObjectByName("Head") as THREE.Mesh;
    const fur = model.root.getObjectByName("velvet fur") as THREE.InstancedMesh;
    const geometryDispose = vi.fn();
    const furDispose = vi.fn();
    head.geometry.addEventListener("dispose", geometryDispose);
    fur.addEventListener("dispose", furDispose);
    disposeAvatar(model.root);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(furDispose).toHaveBeenCalledTimes(1);
  });

  it("exports a portable GLB in a neutral pose without altering live geometry", async () => {
    const model = buildAvatar(
      { ...DEFAULT_CONFIG, headgear: "horned-helm", eyes: "glow" },
      { color: "lime", coat: "plush" },
    );
    animateAvatar(
      model,
      { ...DEFAULT_CONFIG, motion: "hop", eyeMotion: "squint" },
      0.5,
    );
    const y = model.root.position.y;
    const ear = model.parts.find((part) => part.kind === "ear")!.object;
    const earRotation = ear.rotation.z;
    const head = model.root.getObjectByName("Head") as THREE.Mesh;
    const liveDisposed = vi.fn();
    head.geometry.addEventListener("dispose", liveDisposed);
    const glb = await avatarToGlb(model.root);
    const view = new DataView(glb);
    expect(view.getUint32(0, true)).toBe(0x46546c67);
    expect(view.getUint32(4, true)).toBe(2);
    expect(view.getUint32(8, true)).toBe(glb.byteLength);
    const jsonLength = view.getUint32(12, true);
    const json = JSON.parse(
      new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength)),
    );
    expect(json.extensionsUsed ?? []).not.toContain("EXT_mesh_gpu_instancing");
    expect(json.meshes.length).toBeGreaterThan(10);
    const furNode = json.nodes.find(
      (node: { name: string }) => node.name === "plush fur",
    );
    const fur = json.meshes[furNode.mesh];
    expect(fur.primitives[0].attributes.COLOR_0).toBeDefined();
    const root = json.nodes.find(
      (node: { name: string }) => node.name === "Plush orc",
    );
    expect(root.translation).toBeUndefined();
    const gear = json.nodes.find(
      (node: { name: string }) => node.name === "Headgear",
    );
    expect(gear.translation).toBeUndefined();
    expect(gear.rotation).toBeUndefined();
    const exportedEar = json.nodes.find(
      (node: { name: string }) => node.name === "Ear",
    );
    expect(exportedEar.rotation).toBeUndefined();
    expect(model.root.position.y).toBe(y);
    expect(ear.rotation.z).toBe(earRotation);
    expect(liveDisposed).not.toHaveBeenCalled();
    disposeAvatar(model.root);
  }, 15000);
});
