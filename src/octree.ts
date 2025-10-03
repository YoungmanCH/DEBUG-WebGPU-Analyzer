import * as THREE from "three";

// Constants
const maxBoundary = {
  x: 8,
  y: 8,
  z: 8,
};

const colors = [
  new THREE.Color(0xe69b00), // yellow
  new THREE.Color(0xff0000), // red
  new THREE.Color(0xf1a784), // illusion
  new THREE.Color(0x0000ff), // blue
  new THREE.Color(0xc5e908), // green
  new THREE.Color(0xe0a387), // grey
  new THREE.Color(0xf1a784), // illusion
];

export class Point {
  index: number;
  x: number;
  y: number;
  z: number;
  mesh: THREE.Mesh;

  constructor(index: number, x: number, y: number, z: number) {
    this.index = index;
    this.x = x;
    this.y = y;
    this.z = z;
    let mesh = new THREE.Mesh(
      new THREE.BoxGeometry(5, 5, 5),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    mesh.position.set(x, y, z);
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    this.mesh = mesh;
  }
}

export class Box {
  label: string;
  x: number;
  y: number;
  z: number;
  width: number;
  mesh: THREE.Mesh;

  constructor(label: string, x: number, y: number, z: number, width: number, level: number) {
    this.label = label;
    this.x = x;
    this.y = y;
    this.z = z;
    this.width = width;
    let mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, width, width),
      new THREE.MeshBasicMaterial({ color: colors[level % 7], wireframe: true })
    );
    mesh.position.set(x, y, z);
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    this.mesh = mesh;
    // scene.add(mesh);
  }

  bound(point) {
    if (this.x + this.width * 0.5 == 0.5 * maxBoundary.x) {
      return (
        point.x >= this.x - this.width * 0.5 &&
        point.x <= this.x + this.width * 0.5 &&
        point.y < this.y + this.width * 0.5 &&
        point.y >= this.y - this.width * 0.5 &&
        point.z >= this.z - this.width * 0.5 &&
        point.z < this.z + this.width * 0.5
      );
    }
    if (this.y + this.width * 0.5 == 0.5 * maxBoundary.y) {
      return (
        point.x >= this.x - this.width * 0.5 &&
        point.x < this.x + this.width * 0.5 &&
        point.y <= this.y + this.width * 0.5 &&
        point.y >= this.y - this.width * 0.5 &&
        point.z >= this.z - this.width * 0.5 &&
        point.z < this.z + this.width * 0.5
      );
    }
    if (this.z + this.width * 0.5 == 0.5 * maxBoundary.z) {
      return (
        point.x >= this.x - this.width * 0.5 &&
        point.x < this.x + this.width * 0.5 &&
        point.y < this.y + this.width * 0.5 &&
        point.y >= this.y - this.width * 0.5 &&
        point.z >= this.z - this.width * 0.5 &&
        point.z <= this.z + this.width * 0.5
      );
    } else {
      return (
        point.x >= this.x - this.width * 0.5 &&
        point.x < this.x + this.width * 0.5 &&
        point.y < this.y + this.width * 0.5 &&
        point.y >= this.y - this.width * 0.5 &&
        point.z >= this.z - this.width * 0.5 &&
        point.z < this.z + this.width * 0.5
      );
    }
  }
}

export class Octree {
  box: Box;
  minNE: any;
  minNW: any;
  minSW: any;
  minSE: any;
  maxNE: any;
  maxNW: any;
  maxSW: any;
  maxSE: any;
  isDivided: boolean;
  points: any[];
  buffer: any[];
  level: number;
  parent: any;

  constructor(box: Box, level = 0) {
    this.box = box;
    this.minNE = null;
    this.minNW = null;
    this.minSW = null;
    this.minSE = null;
    this.maxNE = null;
    this.maxNW = null;
    this.maxSW = null;
    this.maxSE = null;
    this.isDivided = false;
    // this.representativeNodes = [];
    this.points = [];
    this.buffer = [];
    this.level = level;
    this.parent = null;
  }

  // function findRepresentiveNode(){
  //   let children = [this.minNE, this.minNW, this.minSW, this.minSE, this.maxNE, this.maxNW, this.maxSW, this.maxSE]
  //   children.forEach((element, index)=>{
  //     if(element != null && element.length>0){
  //       this.representativeNodes.push(element.nodes[0])
  //     }
  //   })
  // }

  partition() {
    let x = this.box.x;
    let y = this.box.y;
    let z = this.box.z;
    let newWidth = this.box.width * 0.5;
    let level = this.level + 1;
    let maxNE_Box = new Box(
      "maxNE",
      x + newWidth * 0.5,
      y + 0.5 * newWidth,
      z - 0.5 * newWidth,
      newWidth,
      level
    );
    let maxNW_Box = new Box(
      "maxNW",
      x - newWidth * 0.5,
      y + 0.5 * newWidth,
      z - 0.5 * newWidth,
      newWidth,
      level
    );
    let maxSW_Box = new Box(
      "maxSW",
      x - newWidth * 0.5,
      y - 0.5 * newWidth,
      z - 0.5 * newWidth,
      newWidth,
      level
    );
    let maxSE_Box = new Box(
      "maxSE",
      x + newWidth * 0.5,
      y - 0.5 * newWidth,
      z - 0.5 * newWidth,
      newWidth,
      level
    );

    let minNE_Box = new Box(
      "minNE",
      x + newWidth * 0.5,
      y + 0.5 * newWidth,
      z + 0.5 * newWidth,
      newWidth,
      level
    );
    let minNW_Box = new Box(
      "minNW",
      x - newWidth * 0.5,
      y + 0.5 * newWidth,
      z + 0.5 * newWidth,
      newWidth,
      level
    );
    let minSW_Box = new Box(
      "minSW",
      x - newWidth * 0.5,
      y - 0.5 * newWidth,
      z + 0.5 * newWidth,
      newWidth,
      level
    );
    let minSE_Box = new Box(
      "minSE",
      x + newWidth * 0.5,
      y - 0.5 * newWidth,
      z + 0.5 * newWidth,
      newWidth,
      level
    );

    this.minNE = new Octree(minNE_Box, level);
    this.minNW = new Octree(minNW_Box, level);
    this.minSW = new Octree(minSW_Box, level);
    this.minSE = new Octree(minSE_Box, level);
    this.maxNE = new Octree(maxNE_Box, level);
    this.maxNW = new Octree(maxNW_Box, level);
    this.maxSW = new Octree(maxSW_Box, level);
    this.maxSE = new Octree(maxSE_Box, level);
    this.isDivided = true;
  }

  insert(point) {
    if (!this.box.bound(point)) {
      // console.log(
      //   "out of boundary",
      //   "for node",
      //   point.x,
      //   point.y,
      //   point.z,
      //   "for box",
      //   this.box.x,
      //   this.box.y,
      //   this.box.z,
      //   this.box.width * 0.5,
      //   this.box.label
      // );
      return false;
    }
    if (this.points.length < (tree as any).leafCapacity && !this.isDivided) {
      // this.updateRepresentativeNode();
      this.points.push(point.index);
      // this.sortNode();
      return true;
    } else if (this.buffer.length < (tree as any).bufferCapacity && !this.isDivided) {
      this.buffer.push(point.index);
      return true;
    } else {
      if (!this.isDivided) {
        this.partition();
        this.buffer.forEach((existingPoint) => {
          if (
            existingPoint.x == point.x &&
            existingPoint.y == point.y &&
            existingPoint.z == point.z
          ) {
            console.log("repetitive node not allowed");
            return false;
          }
          this.minNE.insert(existingPoint) ||
            this.minNW.insert(existingPoint) ||
            this.minSE.insert(existingPoint) ||
            this.minSW.insert(existingPoint) ||
            this.maxNE.insert(existingPoint) ||
            this.maxNW.insert(existingPoint) ||
            this.maxSW.insert(existingPoint) ||
            this.maxSE.insert(existingPoint);
        });
        this.buffer = [];
      }
      return (
        this.minNE.insert(point) ||
        this.minNW.insert(point) ||
        this.minSE.insert(point) ||
        this.minSW.insert(point) ||
        this.maxNE.insert(point) ||
        this.maxNW.insert(point) ||
        this.maxSW.insert(point) ||
        this.maxSE.insert(point)
      );
    }
  }
}
