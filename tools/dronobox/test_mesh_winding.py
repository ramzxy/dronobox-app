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

"""Regression checks for CAD face orientation (GPL-3.0-or-later)."""

import unittest

import numpy as np

from mesh_winding import orient_closed_mesh


class WindingTests(unittest.TestCase):
    def setUp(self):
        self.points = np.array([[0., 0, 0], [2, 0, 0], [0, 3, 0], [0, 0, 4]])
        self.faces = np.array([[0, 2, 1], [0, 1, 3], [1, 2, 3], [2, 0, 3]])

    def assert_outward(self, points, faces):
        triangles = points[faces]
        normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
        away = triangles.mean(axis=1) - points.mean(axis=0)
        self.assertTrue(np.all(np.einsum('ij,ij->i', normals, away) > 0))

    def test_every_combination_of_reversed_faces(self):
        for mask in range(16):
            faces = self.faces.copy()
            for index in range(4):
                if mask & (1 << index):
                    faces[index] = faces[index, ::-1]
            result = orient_closed_mesh(self.points, faces)
            self.assert_outward(self.points, result)
            np.testing.assert_array_equal(np.sort(result, axis=1), np.sort(faces, axis=1))

    def test_separate_cad_vertices_and_large_world_offset(self):
        points = self.points[self.faces].reshape(-1, 3) + 1e6
        faces = np.arange(12).reshape(-1, 3)
        faces[1] = faces[1, ::-1]
        self.assert_outward(points, orient_closed_mesh(points, faces))

    def test_rejects_an_open_shell(self):
        with self.assertRaisesRegex(ValueError, 'closed'):
            orient_closed_mesh(self.points, self.faces[:-1])

    def test_rejects_a_collapsed_triangle(self):
        faces = self.faces.copy()
        faces[0, 0] = faces[0, 1]
        with self.assertRaisesRegex(ValueError, 'Collapsed'):
            orient_closed_mesh(self.points, faces)


if __name__ == '__main__':
    unittest.main()
