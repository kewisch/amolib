/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2019 */

import RedashClient from "redash-client";

import { REDASH_URL, REDASH_AMO_DB, REDASH_POLLING_TIMEOUT_MS, ADDON_TYPE_STRINGS } from "./constants";
import * as packageJSON from "../package.json";
import AMOSqlBuilder from "./sql";

export class STMORedashClient extends RedashClient {
  constructor({ apiToken, dataSourceId, debug }) {
    super({
      endPoint: REDASH_URL,
      apiToken: apiToken,
      agent: `${packageJSON.name}/${packageJSON.version}`
    });

    this.debug = debug;
    this.dataSourceId = dataSourceId;
  }

  async sql(query, timeout=REDASH_POLLING_TIMEOUT_MS) {
    if (this.debug) {
      console.warn(query);
    }
    return this.queryAndWaitResult({
      query: query.trim(),
      data_source_id: this.dataSourceId
    }, timeout);
  }

  buildQuery() {
    return new AMOSqlBuilder(this);
  }
}

export class AMORedashClient extends STMORedashClient {
  constructor({ apiToken, debug }) {
    super({
      apiToken: apiToken,
      debug: debug,
      dataSourceId: REDASH_AMO_DB
    });
  }

  async queryMapIds(from, to, ids) {
    if (typeof ids[0] == "string") {
      ids = ids.map(id => JSON.stringify(id));
    }

    let result = await this.sql(`
      SELECT ${from}, ${to} FROM addons WHERE ${from} IN (${ids.join(",")})
    `);

    let data = {};
    for (let row of result.query_result.data.rows) {
      data[row[from]] = row[to];
    }

    return data;
  }

  async queryAllIds(type="guid") {
    let result = await this.sql(`SELECT ${type} FROM addons WHERE ${type} IS NOT NULL`);
    return result.query_result.data.rows.map(row => row[type]);
  }

  async queryUsersForIds(type="id", ids) {
    if (typeof ids[0] == "string") {
      ids = ids.map(id => JSON.stringify(id));
    }

    let result = await this.sql(`
      SELECT au.user_id, u.display_name, u.username
      FROM addons_users au
      LEFT JOIN addons a ON (a.id = au.addon_id)
      LEFT JOIN users u ON (u.id = au.user_id)
      WHERE a.${type} IN (${ids.join(",")})
      GROUP BY au.user_id
    `);

    return result.query_result.data.rows;
  }

  async queryAddonsInvolvedAccounts(guids, addontypes=["extension", "lpapp"]) {
    let types = addontypes.map(type => ADDON_TYPE_STRINGS[type] || type);

    let result = await this.sql(`
      SELECT a.guid
      FROM addons_users au
      LEFT JOIN addons a ON (a.id = au.addon_id)
      WHERE
        au.user_id IN (
          SELECT au.user_id
          FROM addons a
          RIGHT JOIN addons_users au ON (a.id = au.addon_id)
          WHERE a.guid IN (${guids.map(guid => JSON.stringify(guid)).join(",")})
          GROUP BY au.user_id
        )
        AND a.guid NOT LIKE 'guid-reused-by-pk-%'
        AND a.addontype_id IN (${types.join(",")})
        GROUP BY a.id
    `);

    return result.query_result.data.rows.map(row => row.guid);
  }

  async querySeprateLegacyAndWX(guids) {
    let res = await this.buildQuery()
      .select("a.guid")
      .select("SUM(f.is_webextension) < 1 AS has_no_wx")
      .from("addons")
      .join("versions", "v.addon_id = a.id")
      .join("files", "f.version_id = v.id")
      .wherein("guid", guids)
      .groupby("a.id")
      .run();

    let invalidset = new Set(guids);
    let data = res.query_result.data.rows.reduce((acc, { guid, has_no_wx }) => {
      acc[has_no_wx].push(guid);
      invalidset.delete(guid);
      return acc;
    }, [[], []]);

    data.push([...invalidset]);
    return data;
  }
}
