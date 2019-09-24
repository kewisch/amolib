/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2019 */

import request from "request-promise-native";

import { BUGZILLA_URL } from "./constants";

/**
 * A simple bugzilla REST API client.
 */
export class BugzillaClient {
  constructor(baseurl, apikey, readonly=false) {
    this.apikey = apikey || "";
    this.readonly = readonly;

    this.request = request.defaults({
      baseUrl: baseurl + "/rest/",
      headers: { "X-BUGZILLA-API-KEY": this.apikey },
      json: true,
    });
  }

  get authenticated() {
    return !!this.apikey;
  }

  async get(ids) {
    return this.request({
      uri: "/bug",
      qs: { id: ids.join(",") }
    });
  }

  async getComments(ids) {
    let firstid = ids[0];

    let data = await this.request({
      uri: `/bug/${firstid}/comment`,
      qsStringifyOptions: { indices: false },
      qs: { ids: ids }
    });

    if (data.error) {
      throw new Error(`${data.code} - ${data.message}`);
    }

    return data;
  }

  async update(info) {
    if (this.readonly) {
      return {};
    }

    let firstid = info.ids[0];

    let data = await this.request({
      method: "PUT",
      uri: "/bug/" + firstid,
      json: true,
      body: info
    });

    if (data.error) {
      throw new Error(`${data.code} - ${data.message}`);
    }

    return data;
  }

  async create(info) {
    if (this.readonly) {
      return null;
    }
    let data = await this.request({
      method: "POST",
      uri: "/bug",
      body: info
    });

    if (data.error) {
      throw new Error(`${data.code} - ${data.message}`);
    }

    return data.id;
  }

  async whoami() {
    let data = await this.request("/whoami");

    if (data.error) {
      throw new Error(`${data.code} - ${data.message}`);
    }

    return data;
  }
}

export class BMOClient extends BugzillaClient {
  constructor(apikey, readonly=false) {
    super(BUGZILLA_URL, apikey, readonly);
  }
}
