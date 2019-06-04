/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2019 */

import { swap } from "./utils";

export const AMO_HOST = process.env.AMO_HOST || "addons.mozilla.org";
export const AMO_INTERNAL_HOST = process.env.AMO_HOST || "addons-internal.prod.mozaws.net";

export const AMO_BASE = `https://${AMO_HOST}/en-US`;
export const AMO_INTERNAL_BASE = `https://${AMO_INTERNAL_HOST}/en-US`;
export const AMO_API_BASE = `https://${AMO_HOST}/api/v4`;
export const AMO_REVIEWERS_API_BASE = `https://reviewers.${AMO_HOST}/api/v4/reviewers`;
export const AMO_EDITOR_BASE = `https://reviewers.${AMO_HOST}/en-US/reviewers`;
export const AMO_ADMIN_BASE = `${AMO_INTERNAL_BASE}/admin`;
export const AMO_DEVELOPER_BASE = `${AMO_BASE}/developers`;

export const ADDON_STATUS = {
  INCOMPLETE: 0,
  AWAITING_REVIEW: 3,
  APPROVED: 4,
  DISABLED: 5,
  DELETED: 11
};

export const ADDON_STATUS_STRINGS = {
  incomplete: 0,
  waiting: 3,
  approved: 4,
  disabled: 5,
  deleted: 11
};

export const ADDON_FILE_STATUS_STRINGS = {
  approved: 4,
  disabled: 5,
  deleted: 11
};

export const ADDON_STATUS_VALUES = swap(ADDON_STATUS_STRINGS);

export const ADDON_TYPE_STRINGS = {
  extension: 1,
  theme: 2,
  dictionary: 3,
  search: 4,
  lpapp: 5,
  lpaddon: 6,
  plugin: 7,
  lwtheme: 9,
  statictheme: 10
};

export const ADDON_CHANNEL_STRINGS = {
  unlisted: 1,
  listed: 2
};


export const REDASH_URL = "https://sql.telemetry.mozilla.org/";
export const REDASH_AMO_DB = 25;
export const REDASH_POLLING_TIMEOUT_MS = 60 * 1000;

export const BUGZILLA_URL = "https://bugzilla.mozilla.org";

export const RE_ADDON_GUID = /^(\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}|[a-z0-9-._]*@[a-z0-9-._]+)$/i;
