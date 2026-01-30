/* Copyright 2025 Esri
 *
 * Licensed under the Apache License Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export const areUint8ArraysEqual = (arr1: Uint8Array, arr2: Uint8Array) => {
    // handle null or undefined arrays
    if (!arr1 || !arr2) {
        return false;
    }

    // check type of both inputs
    if (!(arr1 instanceof Uint8Array) || !(arr2 instanceof Uint8Array)) {
        return false;
    }

    // if lengths are different, arrays are not equal
    if (arr1.length !== arr2.length) {
        return false;
    }

    // start comparison from the end of the array as the first several hundreds of items in those array
    // will likely be identitical for most of tile images
    for (let i = arr1.length - 1; i >= 0; i--) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }

    return true;
};
