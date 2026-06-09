import * as THREE from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { BloomPass } from "three/addons/postprocessing/BloomPass.js";
import { FilmPass } from "three/addons/postprocessing/FilmPass.js";

import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
} from "https://cdn.skypack.dev/d3-force-3d";

import nodes_ from "./nodes.js";
import edges_ from "./edges.js";

const SCALEX = 0.008;
const SCALEY = 0.004;
const SCALEZ = 0.008;
const COLORN = 16;

const Renderer = {
  init: () => {
    Renderer.scene = new THREE.Scene();

    Renderer.camera = new THREE.PerspectiveCamera(
      30,
      window.innerWidth / window.innerHeight,
      0.1,
      50,
    );
    Renderer.camera.position.set(0, 1, 15);

    Renderer.renderer = new THREE.WebGLRenderer({
      antialias: true,
    });
    Renderer.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(Renderer.renderer.domElement);

    const nodeData = nodes_
      .split("\n")
      .map((r) => r.split(",").map((rr) => rr.trim()));
    const nodes = nodeData.map((r) => {
      return { id: r[0], clusters: r[2].split("/").map((rr) => rr.trim()) };
    });

    const graphLinks = edges_
      .split(`\n`)
      .map((r) => r.split(",").map((rr) => rr.trim()))
      .map((r) => {
        return { source: r[0], target: r[1] };
      });

    Renderer.colors = [
      new THREE.Color(0xec385d),
      new THREE.Color(0x00eeff),
      new THREE.Color(0xe89873),
      new THREE.Color(0xffd700),
      new THREE.Color(0xdd6633),
      new THREE.Color(0xffd700),
      new THREE.Color(0x68edab),
      new THREE.Color(0xe500e5),
      new THREE.Color(0xc406ff),
      new THREE.Color(0x5555ff),
      new THREE.Color(0x00ee44),
      new THREE.Color(0xe500e5),
      new THREE.Color(0xffffff),
      new THREE.Color(0xff8da1),
      new THREE.Color(0xff0000),
      new THREE.Color(0xcccccc),
    ];

    Renderer.colors_ = new Float32Array(Renderer.colors.length * 3);
    for (let i = 0; i < Renderer.colors.length; i++) {
      const c = Renderer.colors[i];
      Renderer.colors_[i * 3 + 0] = c.r;
      Renderer.colors_[i * 3 + 1] = c.g;
      Renderer.colors_[i * 3 + 2] = c.b;
    }

    const clusterIds = [...new Set(nodes.flatMap((node) => node.clusters))];
    console.log(clusterIds.map((c) => `"${c}":""`).join(","));
    const clusterLabels = {
      "Protein biosynthesis": "Biosynthesis",
      "ribosome biogenesis": "Biogenesis",
      Photosynthesis: "Photosynthesis",
      "Cellular respiration": "Respiration",
      "oxidative phosphorylation": "Phosphorylation",
      photophosphorylation: "Photophosphorylation",
      mixed: "Mixed",
      "Protein physical control": "",
      "plastidial protein translocation and insertion": "Plastidial",
      "Solute transport": "Solute",
      "Cytoskeleton organisation": "Cytoskeleton",
      "mitochondrial protein translocation and insertion": "Mitochondrial",
      "RNA processing": "RNA",
      "Protein homeostasis": "Homeostasis",
      "Phytohormone action": "Phytohormone",
      "auxin perception and signal transduction": "Auxin",
    };
    Renderer.labels = [];
    for (let i in clusterIds) {
      const div = document.createElement("div");
      div.classList.add("test");
      div.innerHTML = clusterLabels[clusterIds[i]];
      if (!div.innerHTML) div.style.display = "None";
      div.style.color = `rgb(${[Renderer.colors[i % COLORN].r, Renderer.colors[i % COLORN].g, Renderer.colors[i % COLORN].b].map((x) => parseInt(x * 255) + "").join(",")})`;

      document.body.appendChild(div);
      Renderer.labels.push(div);
    }

    const clusterNodes = clusterIds.map((id) => ({
      id: `cluster:${id}`,
      isCluster: true,
    }));

    const clusterLinks = nodes.flatMap((node) =>
      node.clusters.map((clusterId) => ({
        source: node.id,
        target: `cluster:${clusterId}`,
      })),
    );

    const simulationNodes = [...nodes, ...clusterNodes];
    const simulationLinks = [...graphLinks, ...clusterLinks];

    Renderer.simulation = forceSimulation(simulationNodes, 3)
      .numDimensions(3)
      .force("charge", forceManyBody().strength(-200))
      .force(
        "links",
        forceLink(simulationLinks)
          .id((node) => node.id)
          .distance((link) => (link.target.isCluster ? 100 : 70))
          .strength((link) => (link.target.isCluster ? 0.8 : 0.85)),
      )
      .force("center", forceCenter(0, 0, 0))
      .stop();

    for (let i = 0; i < 100; i++) {
      Renderer.simulation.tick();
    }

    const visibleNodes = simulationNodes.filter((node) => !node.isCluster);

    const clusterNodes_ = simulationNodes.filter((n) => n.isCluster);
    Renderer.nodeMesh = Renderer.createNodeMesh(visibleNodes, clusterNodes_);
    Renderer.edgeMesh = Renderer.createEdgeMesh(graphLinks, clusterNodes_);

    Renderer.scene.add(Renderer.nodeMesh);
    Renderer.scene.add(Renderer.edgeMesh);

    // clusters
    if (false) {
      const nodesByCluster = {};
      for (let cid of clusterIds) nodesByCluster[cid] = [];
      for (let n of nodes) {
        for (let c of n.clusters) nodesByCluster[c].push(n);
      }

      let ci = 0;

      for (let cid in nodesByCluster) {
        const c = nodesByCluster[cid];

        const points = c.map(
          (node) =>
            new THREE.Vector3(
              node.x * SCALEX,
              node.y * SCALEY,
              node.z * SCALEZ,
            ),
        );

        const geometry = new ConvexGeometry(points);
        const material = new THREE.MeshBasicMaterial({
          color: Renderer.colors[ci % COLORN],
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

        const mesh = new THREE.Mesh(geometry, material);
        Renderer.scene.add(mesh);
        ci++;
      }
    }

    Renderer.animate();
  },

  createNodeMesh: (nodes, clusterNodes) => {
    const geometry = new THREE.SphereGeometry(0.04, 16, 16);

    const nodeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        clusterCount: { value: clusterNodes.length },
        clusterCenters: {
          value: clusterNodes.map(
            (n) => new THREE.Vector3(n.x * SCALEX, n.y * SCALEY, n.z * SCALEZ),
          ),
        },
        clusterColors: { value: Renderer.colors_ },
      },

      vertexShader: `
    varying vec3 vWorldPosition;

    void main() {
      vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vWorldPosition = (instanceMatrix * vec4(position, 1.0)).xyz;

      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,

      fragmentShader: `
    precision highp float;

    uniform int clusterCount;
    uniform vec3 clusterCenters[16];
    uniform vec3 clusterColors[16];

    varying vec3 vWorldPosition;

    void main() {
      float bestDistance = 1e20;
      vec3 bestColor = vec3(1.0);

      for (int i = 0; i < 16; i++) {
        if (i >= clusterCount) break;

        float d = distance(vWorldPosition, clusterCenters[i]);

        if (d < bestDistance) {
          bestDistance = d;
          bestColor = clusterColors[i%${COLORN}];
        }
      }

      gl_FragColor = vec4(bestColor, 1.0);
    }
  `,
    });

    const mesh = new THREE.InstancedMesh(geometry, nodeMaterial, nodes.length);

    const dummy = new THREE.Object3D();

    nodes.forEach((node, index) => {
      dummy.position.set(node.x * SCALEX, node.y * SCALEY, node.z * SCALEZ);
      const r = Math.random() * 1.5 + 0.5;
      dummy.scale.set(r, r, r);
      dummy.updateMatrix();

      mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;

    return mesh;
  },

  createEdgeMesh: (links, clusterNodes) => {
    const radius = 0.013;

    const geometry = new THREE.CylinderGeometry(radius, radius, 1, 6);

    const startColors = new Float32Array(links.length * 3);
    const endColors = new Float32Array(links.length * 3);

    const clusterCenters = clusterNodes.map(
      (n) => new THREE.Vector3(n.x * SCALEX, n.y * SCALEY, n.z * SCALEZ),
    );
    const clusterCenters2 = clusterNodes.map(
      (n) =>
        new THREE.Vector3(
          n.x * SCALEX + (Math.random() - 0.5) * 0,
          n.y * SCALEY + (Math.random() - 0.5) * 1,
          n.z * SCALEZ + (Math.random() - 0.5) * 0,
        ),
    );
    Renderer.clusterCenters = clusterCenters2;

    const getClosestClusterIndex = (point) => {
      let bestIndex = 0;
      let bestDistance = Infinity;

      for (let i = 0; i < clusterCenters.length; i++) {
        const d = point.distanceToSquared(clusterCenters[i]);

        if (d < bestDistance) {
          bestDistance = d;
          bestIndex = i;
        }
      }

      return bestIndex;
    };

    const edgeMaterial = new THREE.ShaderMaterial({
      transparent: true,
      vertexShader: `
      attribute vec3 instanceStartColor;
      attribute vec3 instanceEndColor;

      varying vec3 vColor;
      varying float vT;

      void main() {
        // CylinderGeometry height is 1, centered at origin.
        // local y goes from -0.5 to +0.5.
        vT = position.y + 0.5;

        vColor = mix(instanceStartColor, instanceEndColor, vT);

        vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,

      fragmentShader: `
      precision highp float;

      varying vec3 vColor;

      void main() {
        gl_FragColor = vec4(vColor, 0.4);
      }
    `,
    });

    const mesh = new THREE.InstancedMesh(geometry, edgeMaterial, links.length);

    const dummy = new THREE.Object3D();

    const start = new THREE.Vector3();
    const end = new THREE.Vector3();
    const midpoint = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const yAxis = new THREE.Vector3(0, 1, 0);

    let index = 0;

    for (const link of links) {
      const source = link.source;
      const target = link.target;

      start.set(source.x * SCALEX, source.y * SCALEY, source.z * SCALEZ);
      end.set(target.x * SCALEX, target.y * SCALEY, target.z * SCALEZ);

      direction.subVectors(end, start);

      const length = direction.length();
      if (length === 0) continue;

      midpoint.copy(start).add(end).multiplyScalar(0.5);

      dummy.position.copy(midpoint);
      dummy.quaternion.setFromUnitVectors(yAxis, direction.normalize());
      dummy.scale.set(1, length, 1);
      dummy.updateMatrix();

      mesh.setMatrixAt(index, dummy.matrix);

      const startClusterIndex = getClosestClusterIndex(start);
      const endClusterIndex = getClosestClusterIndex(end);

      const startColor = Renderer.colors[startClusterIndex % COLORN];
      const endColor = Renderer.colors[endClusterIndex % COLORN];

      startColors[index * 3 + 0] = startColor.r;
      startColors[index * 3 + 1] = startColor.g;
      startColors[index * 3 + 2] = startColor.b;

      endColors[index * 3 + 0] = endColor.r;
      endColors[index * 3 + 1] = endColor.g;
      endColors[index * 3 + 2] = endColor.b;

      index++;
    }

    mesh.count = index;
    mesh.instanceMatrix.needsUpdate = true;

    geometry.setAttribute(
      "instanceStartColor",
      new THREE.InstancedBufferAttribute(startColors, 3),
    );

    geometry.setAttribute(
      "instanceEndColor",
      new THREE.InstancedBufferAttribute(endColors, 3),
    );

    return mesh;
  },

  worldToScreen: (position) => {
    const p = position.clone().project(Renderer.camera);

    return {
      x: (p.x * 0.5 + 0.5) * Renderer.renderer.domElement.clientWidth,
      y: (-p.y * 0.5 + 0.5) * Renderer.renderer.domElement.clientHeight,
      z: p.z,
      // visible: p.z >= -1 && p.z <= 1,
    };
  },

  animate: () => {
    requestAnimationFrame(Renderer.animate);

    const t = performance.now() * 0.00005; // orbit speed
    const radius = 30;
    Renderer.camera.position.set(Math.cos(t) * radius, 2, Math.sin(t) * radius);
    Renderer.camera.lookAt(0, 0, 0);

    for (let i in Renderer.labels) {
      const pos = Renderer.worldToScreen(Renderer.clusterCenters[i]);
      Renderer.labels[i].style.top = `${parseInt(pos.y)}px`;
      Renderer.labels[i].style.left = `${parseInt(pos.x)}px`;
      Renderer.labels[i].style.zIndex = 1000 - parseInt(pos.z * 1000);
    }

    Renderer.renderer.render(Renderer.scene, Renderer.camera);
  },
};

Renderer.init();

export default Renderer;
