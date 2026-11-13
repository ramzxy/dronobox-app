# This file is part of Betaflight.
#
# Betaflight is free software. You can redistribute this software
# and/or modify this software under the terms of the GNU General
# Public License as published by the Free Software Foundation,
# either version 3 of the License, or (at your option) any later
# version.
#
# Betaflight is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
#
# See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public
# License along with this software.
#
# If not, see <http://www.gnu.org/licenses/>.

"""Orient each closed CAD shell consistently, then point its triangles outwards.

GPL-3.0-or-later; see DEFAULT_LICENSE.md.
"""

from collections import defaultdict, deque

import numpy as np


def orient_closed_mesh(positions, triangles):
    # CAD faces have separate vertices for sharp shading. Weld only for adjacency;
    # keep the original vertex buffers and indices for rendering.
    _, welded = np.unique(positions, axis=0, return_inverse=True)
    faces = welded[triangles]
    edges = defaultdict(list)
    for face, (a, b, c) in enumerate(faces):
        for start, end in ((a, b), (b, c), (c, a)):
            if start == end:
                raise ValueError("Collapsed CAD triangle")
            edges[(min(start, end), max(start, end))].append((face, start < end))

    neighbours = [[] for _ in faces]
    for pair in edges.values():
        if len(pair) != 2:
            raise ValueError("CAD shell must be closed and manifold")
        (a, forward_a), (b, forward_b) = pair
        opposite = forward_a == forward_b
        neighbours[a].append((b, opposite))
        neighbours[b].append((a, opposite))

    flips = np.full(len(faces), -1, dtype=np.int8)
    result = triangles.copy()
    for seed in range(len(faces)):
        if flips[seed] != -1:
            continue
        flips[seed] = 0
        queue = deque([seed])
        component = []
        while queue:
            face = queue.popleft()
            component.append(face)
            for neighbour, opposite in neighbours[face]:
                expected = int(flips[face]) ^ int(opposite)
                if flips[neighbour] == -1:
                    flips[neighbour] = expected
                    queue.append(neighbour)
                elif flips[neighbour] != expected:
                    raise ValueError("Non-orientable CAD shell")

        component = np.asarray(component)
        reverse = component[flips[component] == 1]
        result[reverse] = result[reverse, ::-1]
        points = positions[result[component]].astype(np.float64)
        points -= points.mean(axis=(0, 1))
        volume = np.einsum("ij,ij->i", points[:, 0], np.cross(points[:, 1], points[:, 2])).sum()
        if volume < 0:
            result[component] = result[component, ::-1]
    return result
