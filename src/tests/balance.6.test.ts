/**
 * Balance playouts, shard 6 of six. See `balanceSuite.ts` for why this is six files and
 * not one — in short, one file is one worker, and this used to be 83% of the whole suite.
 *
 * Nothing to edit here. The shard owns every sixth encounter in registry order, and
 * `balanceShards.test.ts` proves the six of them partition the catalogue exactly.
 */

import { describeBalanceShard } from './balanceSuite.js';

describeBalanceShard(5);
