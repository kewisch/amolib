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

export const ADDON_STATUS_VALUES = swap(ADDON_STATUS_STRINGS);
