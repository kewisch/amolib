/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2019 */

import fs from "fs";
import os from "os";
import path from "path";

var gConfigData = null;

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

/**
 * Read the configuration file, which can either still be an ini file, or a JSON file.
 *
 * @return {Object}         The configuration object.
 */
function readConfig() {
  let amorc = path.join(os.homedir(), ".amorc");
  let mode = fs.statSync(amorc).mode;
  if ((mode & 0o077) != 0) {
    let strmode = (mode & 0o777).toString(8);
    throw new Error(`Refusing to open ~/.amorc as it has mode 0${strmode} and may contain secrets. Lock it down to 0600.`);
  }

  let data;
  try {
    data = fs.readFileSync(amorc, "utf-8");
  } catch (e) {
    return {};
  }

  if (data[0] == "[") {
    throw new Error("Your ~/.amorc is still in ini format, you need to convert it to JSON");
  }

  return JSON.parse(data);
}

/**
 * Return the configuration data from the file, either by reading it or the cached copy.
 *
 * @param {...string} configpath    The configuration path to look up.
 * @return {Object}                 The configuration object at this path.
 */
export function getConfig(...configpath) {
  if (!gConfigData) {
    gConfigData = readConfig();
  }

  if (configpath) {
    let data = gConfigData;
    while (data && configpath.length) {
      let next = configpath.shift();
      data = data[next];
    }
    return data;
  } else {
    return gConfigData;
  }
}

/**
 * Find out if the ids passed are internal ids, guids, or slugs, or a mixture thereof
 *
 * @param {string[]} data   Array of ids
 * @return {string}         The type, "id", "guid", "slug" or "mixed".
 */
export function detectIdType(data) {
  let RE_GUID = /^(\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}|[a-z0-9-._]*@[a-z0-9-._]+)$/i;
  let RE_IDS = /^[0-9]+$/;
  let countGuids = 0;
  let countIds = 0;
  for (let line of data) {
    if (line.match(RE_IDS)) {
      countIds++;
    } else if (line.match(RE_GUID)) {
      countGuids++;
    }
  }

  let total = data.length;
  if (countIds == total) {
    return "id";
  } else if (countGuids == total) {
    return "guid";
  } else if (countGuids + countIds > 0) {
    return "mixed";
  } else {
    return "slug";
  }
}
