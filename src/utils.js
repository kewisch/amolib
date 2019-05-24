/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2019 */

import os from "os";

export function swap(obj) {
  return Object.keys(obj).reduce((swapped, key) => {
    swapped[obj[key]] = key;
    return swapped;
  }, {});
}

export function formToObject(formNode) {
  let form = {};
  for (let node of formNode.querySelectorAll("input")) {
    if (node.getAttribute("type") == "submit") {
      continue;
    }

    form[node.getAttribute("name")] = node.getAttribute("value") || "";
  }

  return form;
}

export function requiresVPN() {
  let hasVPN = Object.entries(os.networkInterfaces()).find(([iface, [data]]) => {
    return data.address.startsWith("10.") && iface.startsWith("utun");
  });

  if (!hasVPN) {
    throw new Error("This call requires VPN, looks like you are not connected");
  }
}
