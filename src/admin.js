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
  constructor(session, addonId, autocommit=true) {
    this.session = session;
    this.addonId = addonId;
    this.autocommit = true;
    this._addonSlug = null;
    this.files = [];
    this.loaded = false;
  }

  get addonSlug() {
    return this._addonSlug || this.addonId;
  }

  async ensureLoaded() {
    if (!this.loaded) {
      await this.load();
    }
  }

  async load() {
    this.loaded = true;
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
      let isContinuation = row.firstElementChild.getAttribute("colspan") == "3";
      let continuationRow = isContinuation ? row.previousElementSibling : row;
      let rowBase = isContinuation ? -2 : 0;

      files.push({
        id: parseInt(row.querySelector(`td:nth-of-type(${rowBase + 4}) a`).textContent, 10),
        name: row.querySelector(`td:nth-of-type(${rowBase + 4}) a`).getAttribute("title"),
        date: continuationRow.querySelector("td:nth-of-type(1)").textContent,
        version: {
          id: parseInt(continuationRow.querySelector("td:nth-of-type(2) a").getAttribute("title"), 10),
          name: continuationRow.querySelector("td:nth-of-type(2) a").textContent,
          channel: continuationRow.querySelector("td:nth-of-type(3)").textContent
        },
        platforms: row.querySelector(`td:nth-of-type(${rowBase + 5})`).textContent,
        status: this.getFileStatus(row, rowBase),
        hash: row.querySelector(`td:nth-of-type(${rowBase + 7}) a`).getAttribute("title")
      });
    }

    return files;
  }

  getFileStatus(row, rowBase) {
    let column = row.querySelector(`td:nth-of-type(${rowBase + 6})`);
    let text = [...column.childNodes].filter(node => node.nodeType == 3).map(node => node.nodeValue.trim()).join("");
    if (text == "Deleted") {
      return ADDON_STATUS.DELETED;
    } else {
      return parseInt(column.querySelector("select").value, 10);
    }
  }

  async update(files=null) {
    if (files === null) {
      files = this.files;
    }

    files = files.filter(file => file.status != ADDON_STATUS.DELETED);

    let form = {
      "status": this.status,
      "csrfmiddlewaretoken": this.token,
      "form-TOTAL_FORMS": files.length,
      "form-INITIAL_FORMS": files.length,
      "form-MIN_NUM_FORMS": 0,
      "form-MAX_NUM_FORMS": Math.max(1000, files.length),
    };

    for (let i = 0, len = files.length; i < len; i++) {
      form[`form-${i}-status`] = files[i].status;
      form[`form-${i}-id`] = files[i].id;
    }
    console.log("FILES", files.length, form);

    let uri = `${AMO_ADMIN_BASE}/addon/manage/${this.addonSlug}/`;
    let response = await this.session.request({
      method: "POST",
      uri: uri,
      form: form,
      headers: { Referer: uri }
    });

    if (response.statusCode != 302 ||
        !response.headers.location.includes(`/addon/manage/${this.addonSlug}/`)) {
      throw new Error("Updating failed: " + response.statusCode);
    }
  }

  async disableFiles(files=null) {
    await this.ensureLoaded();

    if (!files) {
      files = this.files;
    }

    for (let file of files) {
      if (file.status !== ADDON_STATUS.DELETED) {
        file.status = ADDON_STATUS.DISABLED;
      }
    }

    if (this.autocommit) {
      await this.update();
    }
  }

  async enableFiles(files=null) {
    await this.ensureLoaded();

    if (!files) {
      files = this.files;
    }

    for (let file of files) {
      file.status = ADDON_STATUS.APPROVED;
    }

    if (this.autocommit) {
      await this.update();
    }
  }

  async enableVersions(versions) {
    let versionSet = new Set(versions);
    let toEnable = this.files.filter(file => versionSet.has(file.version.name));
    return this.enableFiles(toEnable);
  }

  async disableVersions(versions) {
    let versionSet = new Set(versions);
    let toEnable = this.files.filter(file => versionSet.has(file.version.name));
    return this.disableFiles(toEnable);
  }
}


export class DjangoUserModels {
  constructor(session, query=null) {
    this.session = session;
    this.query = query;
  }

  async ensureLoaded() {
    if (!this.token) {
      await this.load();
    }
  }

  async load() {
    let response = await this.session.request({
      uri: `${AMO_ADMIN_BASE}/models/users/userprofile/`,
      qs: { q: this.query } // eslint-disable-line id-length
    });
    let document = response.document;

    this.token = document.querySelector("input[name='csrfmiddlewaretoken']").getAttribute("value");

    // TODO also load the rows
  }

  async ban(users=null) {
    await this.ensureLoaded();

    let allusers = users ? users : this.query.split(",");
    let query = users ? users.join(",") : this.query;

    let response = await this.session.request({
      uri: `${AMO_ADMIN_BASE}/models/users/userprofile/`,
      method: "POST",
      qs: { q: query }, // eslint-disable-line id-length
      qsStringifyOptions: { indices: false },
      headers: { Referer: `${AMO_ADMIN_BASE}/models/users/userprofile/` },
      form: {
        csrfmiddlewaretoken: this.token,
        action: "ban_action",
        select_across: 0,
        index: 0,
        _selected_action: allusers
      }
    });

    let message = response.caseless.get("set-cookie").find(cookie => cookie.startsWith("messages"));

    if (response.statusCode != 302 ||
        !response.headers.location.includes("/models/users/userprofile/") ||
        !message.includes("have been banned")) {
      throw new Error(`Banning users failed (${response.statusCode}): ${message}`);
    }
  }
}
