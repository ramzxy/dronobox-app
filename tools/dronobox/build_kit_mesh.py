"""
Converts the DronoBox V2 STEP assembly into the compact mesh file the app's 3D stage loads.

Usage (needs gmsh + numpy):
    python build_kit_mesh.py DronoBoxV2.step out/dronobox-v2.bin

Each CAD face keeps its own vertices, so normals computed in the browser stay smooth inside a
face and sharp across the edges between faces, which is how machined/printed parts should look.

File layout (little endian):
    u32 header_length, header (UTF-8 JSON), padding to 4 bytes,
    then per part: int16 xyz positions (quantised over header.bounds), padding to 4 bytes,
    u16 or u32 triangle indices, padding to 4 bytes.
The header lists each part's name, vertex/index counts and byte offsets.
"""

import json
import struct
import sys

import gmsh
import numpy as np

from mesh_winding import orient_closed_mesh

# Volume tags as gmsh numbers them for "Prototype v75.step" (DronoBoxV2.step, Oct 2025 export).
# Checked against bounding boxes: body 105 x 35 x 105 mm, arms 138 mm reach, lid dome 45 mm tall.
GROUPS = {
    "body": [77],
    # The four arms (78, 82, 81, 80) and four ESC plates (79, 85, 84, 83) are the same part
    # turned 90 degrees about the vertical axis (checked: 98.8 % / 100 % of vertices coincide),
    # so one of each is stored and the stage places the other three with "copies".
    "arm": [78],
    "esc": [79],
    "lid": [86],
    "latches": [87, 88, 89, 90],
    "fc": [1],
    "pdb": [6] + list(range(7, 73)),
    "standoffs": [2, 3, 4, 5],
    "screws": [73, 74, 75, 76],
}

# Largest triangle edge (mm). Curved faces get finer triangles from MeshSizeFromCurvature.
MESH_SIZE = 6.0


def mesh_volumes(tags):
    """Triangles of every boundary face of the given volumes, one vertex set per face."""
    positions, indices = [], []
    base = 0
    for vol in tags:
        volume_start = len(positions)
        volume_base = base
        # oriented=True signs each face: negative means its triangles wind inwards relative to
        # this volume, so they are flipped to keep every normal pointing out of the part.
        faces = gmsh.model.getBoundary([(3, vol)], oriented=True, combined=False)
        for dim, signed_face in faces:
            face = abs(signed_face)
            node_tags, coords, _ = gmsh.model.mesh.getNodes(2, face, includeBoundary=True)
            elem_types, _, elem_nodes = gmsh.model.mesh.getElements(2, face)
            if not len(node_tags) or not elem_types:
                continue
            lookup = {int(t): i for i, t in enumerate(node_tags)}
            tri = None
            for etype, enodes in zip(elem_types, elem_nodes):
                if etype == 2:  # 3-node triangle
                    tri = np.array([lookup[int(n)] for n in enodes], dtype=np.int64).reshape(-1, 3)
            if tri is None:
                continue
            if signed_face < 0:
                tri = tri[:, ::-1]
            positions.append(np.asarray(coords, dtype=np.float64).reshape(-1, 3))
            indices.append(tri + base)
            base += len(node_tags)
        # Orient each solid separately: neighbouring electronics can touch, so
        # welding the entire assembly would create artificial non-manifold edges.
        volume_positions = np.concatenate(positions[volume_start:])
        volume_indices = np.concatenate(indices[volume_start:]) - volume_base
        oriented = orient_closed_mesh(np.round(volume_positions, 6), volume_indices) + volume_base
        cursor = 0
        for face_index in range(volume_start, len(indices)):
            count = len(indices[face_index])
            indices[face_index] = oriented[cursor:cursor + count]
            cursor += count
    return np.concatenate(positions), np.concatenate(indices)


def main(step_path, out_path):
    gmsh.initialize()
    gmsh.option.setNumber("General.Terminal", 0)
    gmsh.option.setNumber("Geometry.OCCImportLabels", 1)
    gmsh.model.occ.importShapes(step_path, highestDimOnly=True)
    gmsh.model.occ.synchronize()

    gmsh.option.setNumber("Mesh.MeshSizeMax", MESH_SIZE)
    gmsh.option.setNumber("Mesh.MeshSizeMin", 1.2)
    gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", 6)
    gmsh.option.setNumber("Mesh.Algorithm", 6)
    gmsh.model.mesh.generate(2)

    parts = {}
    for name, tags in GROUPS.items():
        parts[name] = mesh_volumes(tags)
        print(f"{name:14s} {len(parts[name][0]):7d} verts {len(parts[name][1]):7d} tris", flush=True)
    gmsh.finalize()

    all_pos = np.concatenate([p for p, _ in parts.values()])
    lo, hi = all_pos.min(axis=0), all_pos.max(axis=0)
    scale = (hi - lo) / 65534.0

    header = {
        "units": "mm",
        "upAxis": "y",
        "bounds": {"min": lo.tolist(), "max": hi.tolist()},
        # rotY in quarter turns about +y, matching three.js rotation.y = rotY * 90 degrees.
        "copies": {"arm": [0, 1, 2, 3], "esc": [0, 1, 2, 3]},
        "parts": [],
    }
    blobs = []
    offset = 0

    def pad(buf):
        return buf + b"\0" * (-len(buf) % 4)

    for name, (pos, idx) in parts.items():
        q = np.round((pos - lo) / scale - 32767).astype(np.int16)
        pos_bytes = pad(q.tobytes())
        wide = len(pos) > 65535
        idx_bytes = pad(idx.astype(np.uint32 if wide else np.uint16).tobytes())
        header["parts"].append(
            {
                "name": name,
                "vertices": len(pos),
                "indices": int(idx.size),
                "positionOffset": offset,
                "indexOffset": offset + len(pos_bytes),
                "indexType": "u32" if wide else "u16",
            }
        )
        blobs += [pos_bytes, idx_bytes]
        offset += len(pos_bytes) + len(idx_bytes)

    head = pad(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    with open(out_path, "wb") as f:
        f.write(struct.pack("<I", len(head)))
        f.write(head)
        for b in blobs:
            f.write(b)
    print("wrote", out_path, 4 + len(head) + offset, "bytes")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
