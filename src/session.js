/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2019 */

import { AMO_BASE, AMO_INTERNAL_BASE } from "./constants";
import { JSDOM } from "jsdom";

import requestDebug from "request-debug";
import request from "request-promise-native";
import fs from "fs";


export class AMOSession {
  constructor({ debug=false, dryrun=false }) {
    if (debug) {
      requestDebug(request);
    }

    this.jar = request.jar();
    this.dryrun = dryrun;
    this._request = request.defaults({
      jar: this.jar,
      resolveWithFullResponse: true,
      simple: false,
      transform2xxOnly: true,
      transform: (body, response, resolveWithFullResponse) => {
        if (response.caseless.get("content-type").startsWith("text/html")) {
          response.document = new JSDOM(body).window.document;
          return resolveWithFullResponse ? response : response.document;
        } else if (response.caseless.get("content-type") == "application/json") {
          response.json = JSON.parse(body);
          return resolveWithFullResponse ? response : response.json;
        }
        return resolveWithFullResponse ? response : response.body;
      }
    });
  }

  loadSessionId(id) {
    this.jar.setCookie(this._request.cookie("sessionid=" + id), AMO_BASE);
    this.jar.setCookie(this._request.cookie("sessionid=" + id), AMO_INTERNAL_BASE);
  }

  loadCookies(cookiepath) {
    var cookiedata = JSON.parse(fs.readFileSync(cookiepath, "utf-8"));
    for (let [name, value] of Object.entries(cookiedata)) {
      this.jar.setCookie(this._request.cookie(`${name}=${value}`), AMO_INTERNAL_BASE);
      this.jar.setCookie(this._request.cookie(`${name}=${value}`), AMO_BASE);
    }
  }

  async request(...args) {
    if (this.dryrun) {
      console.log(args);
      throw new Error("dry run");
    }
    let response = await this._request(...args);
    if ((response.statusCode == 302 && response.headers.location.includes("accounts.firefox.com")) ||
        response.request.host == "accounts.firefox.com") {
      throw new Error("Authorization Failed");
    }

    return response;
  }
}
