#!/usr/bin/env node
/**
 * CQM CLI バイナリエントリーポイント
 */
import { CQMCli } from './cli.js';

const cli = new CQMCli();
cli.run(process.argv);