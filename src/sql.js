/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2019 */

import { REDASH_POLLING_TIMEOUT_MS } from "./constants";

const TABLE_SHORT = {
  files: "f",
  addons: "a",
  versions: "v"
};

export default class AMOSqlBuilder {
  constructor(client) {
    this._from = null;
    this._fields = [];
    this._join = {};
    this._customjoin = [];
    this._where = [];
    this._having = [];
    this._groupby = null;
    this._orderby = null;
    this.client = client;
  }

  async run(timeout=REDASH_POLLING_TIMEOUT_MS) {
    return this.client.sql(this.toString(), timeout);
  }

  from(tbl) {
    this._from = tbl;
    return this;
  }

  select(...fields) {
    this._fields = this._fields.concat(fields);
    return this;
  }

  customjoin(str) {
    this._customjoin.push(str);
    return this;
  }

  join(tbl, relation=null) {
    if (relation) {
      this._join[tbl] = relation;
      return this;
    }

    if (this._from == "files") {
      switch (tbl) {
        case "addons":
          this.join("addons", "a.id = v.addon_id");
          // Fallthrough intended
        case "versions":
          this.join("versions", "v.id = f.version_id");
          break;
      }
    }
    return this;
  }

  groupby(fields) {
    this._groupby = (this._groupby || "") + " " + fields;
    return this;
  }

  orderby(fields) {
    this._orderby = (this._orderby || "") + " " + fields;
    return this;
  }

  where(condition) {
    this._where.push(condition);
    return this;
  }

  wherein(field, values) {
    return this.where(field + " IN (" + values.map(JSON.stringify).join(",") + ")");
  }

  having(condition) {
    this._having.push(condition);
    return this;
  }


  toString() {
    let stmt = ["SELECT " + this._fields.join(", ")];
    stmt.push(`FROM ${this._from} ${TABLE_SHORT[this._from] || ""}`);

    for (let [tbl, relation] of Object.entries(this._join)) {
      stmt.push(`LEFT JOIN ${tbl} ${TABLE_SHORT[tbl] || ""} ON (${relation})`);
    }

    stmt.push(this._customjoin.join("\n"));

    if (this._where.length) {
      stmt.push("WHERE " + this._where.join("\n  AND "));
    }

    if (this._groupby) {
      stmt.push("GROUP BY " + this._groupby);
    }

    if (this._having.length) {
      stmt.push("HAVING " + this._having.join("\n AND "));
    }

    if (this._orderby) {
      stmt.push("ORDER BY " + this._orderby);
    }

    return stmt.join("\n");
  }
}
