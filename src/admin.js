/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2019 */

import { AMO_ADMIN_BASE, ADDON_STATUS } from "./constants";
import { formToObject } from "./utils";

export class UserAdminPage {
  constructor(session, userId) {
    this.session = session;
    this.userId = userId;
    this.data = null;
  }

  async ensureLoaded() {
    if (!this.data) {
      await this.load();
    }
  }

  async load() {
    let response = await this.session.request(`${AMO_ADMIN_BASE}/models/users/userprofile/${this.userId}/change/`);
    this.data = formToObject(response.document.querySelector("form"));
  }

  async ban() {
    await this.ensureLoaded();

    let response = await this.session.request({
      method: "POST",
      uri: `${AMO_ADMIN_BASE}/models/users/userprofile/${this.userId}/ban/`,
      form: this.data,
      headers: { Referer: `${AMO_ADMIN_BASE}/models/users/userprofile/${this.userId}/change/` },
    });

    let message = response.caseless.get("set-cookie").find(cookie => cookie.startsWith("messages"));
    if (!message.includes("has been banned")) {
      throw new Error("Banning user failed: " + message);
    }
  }
}


export class AddonAdminPage {
  constructor(session, addonId) {
    this.session = session;
    this.addonId = addonId;
    this._addonSlug = null;
    this.files = [];
  }

  get addonSlug() {
    return this._addonSlug || this.addonId;
  }

  async ensureLoaded() {
    if (!this.files.length) {
      await this.load();
    }
  }

  async load() {
    this.files = await this.loadPage(1);
    let promises = [];
    for (let i = 2; i <= this.pageCount; i++) {
      promises.push(this.loadPage(i));
    }

    let pages = await Promise.all(promises);
    for (let files of pages) {
      this.files.push(...files);
    }

    return this.files;
  }

  async loadPage(page=1) {
    let response = await this.session.request({
      uri: `${AMO_ADMIN_BASE}/addon/manage/${this.addonSlug}/`,
      qs: { page },
    });
    let document = response.document;

    let slugparts = response.request.uri.pathname.split("/");
    this._addonSlug = slugparts[slugparts.length - 2];

    this.status = document.querySelector("#id_status").value;
    this.token = document.querySelector("input[name='csrfmiddlewaretoken']").getAttribute("value");

    let pages = document.querySelector(".listing-footer .pagination li:nth-last-of-type(2) a");
    this.pageCount = pages ? parseInt(pages.textContent, 10) : 1;

    let files = [];
    for (let row of document.querySelectorAll("table > tbody > tr")) {
      files.push({
        id: parseInt(row.querySelector("td:nth-of-type(4) a").textContent, 10),
        name: row.querySelector("td:nth-of-type(4) a").getAttribute("title"),
        date: row.querySelector("td:nth-of-type(1)").textContent,
        version: {
          id: parseInt(row.querySelector("td:nth-of-type(2) a").getAttribute("title"), 10),
          name: row.querySelector("td:nth-of-type(2) a").textContent,
          channel: row.querySelector("td:nth-of-type(3)").textContent
        },
        platforms: row.querySelector("td:nth-of-type(5)").textContent,
        status: parseInt(row.querySelector("td:nth-of-type(6) select").value, 10),
        hash: row.querySelector("td:nth-of-type(7) a").getAttribute("title")
      });
    }

    return files;
  }

  async update(files=null) {
    if (!files) {
      files = this.files;
    }

    let form = {
      "status": this.status,
      "form-TOTAL_FORMS": files.length,
      "form-INITIAL_FORMS": files.length,
      "form-MIN_NUM_FORMS": 0,
      "form-MAX_NUM_FORMS": Math.max(1000, files.length),
      "csrfmiddlewaretoken": this.token
    };

    for (let i = 0, len = files.length; i < len; i++) {
      form[`form-${i}-status`] = files[i].status;
      form[`form-${i}-id`] = files[i].id;
    }

    let uri = `${AMO_ADMIN_BASE}/addon/manage/${this.addonSlug}/`;
    let response = await this.session.request({
      method: "POST",
      uri: uri,
      form: form,
      headers: { Referer: uri }
    });

    if (response.statusCode != 302 &&
        !response.headers.location.includes(`/addon/manage/${this.addonSlug}/`)) {
      throw new Error("Updating failed: " + response.statusCode);
    }
  }

  async disableFiles(files=null, commit=true) {
    await this.ensureLoaded();

    if (!files) {
      files = this.files;
    }

    for (let file of files) {
      file.status = ADDON_STATUS.DISABLED;
    }

    if (commit) {
      await this.update();
    }
  }

  async enableFiles(files=null, commit=true) {
    await this.ensureLoaded();

    if (!files) {
      files = this.files;
    }

    for (let file of files) {
      file.status = ADDON_STATUS.APPROVED;
    }

    if (commit) {
      await this.update();
    }
  }

  async enableVersions(versions, commit=true) {
    let versionSet = new Set(versions);
    let toEnable = this.files.filter(file => versionSet.has(file.version.name));
    return this.enableFiles(toEnable, commit);
  }

  async disableVersions(versions, commit=true) {
    let versionSet = new Set(versions);
    let toEnable = this.files.filter(file => versionSet.has(file.version.name));
    return this.disableFiles(toEnable, commit);
  }
}
