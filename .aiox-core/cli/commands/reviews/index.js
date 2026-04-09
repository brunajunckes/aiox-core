/**
 * Review Request Manager Command Module
 *
 * Subcommands:
 *   aiox reviews create "<title>" --files "a.js,b.js"     — create review request
 *   aiox reviews list                                      — list pending reviews
 *   aiox reviews complete <id> --verdict approve|reject    — complete a review
 *   aiox reviews stats                                     — review metrics
 *   aiox reviews --format json                             — output as JSON
 *
 * @module cli/commands/reviews
 * @version 1.0.0
 * @story 25.4 — Review Request Manager
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Constants ────────────────────────────────────────────────────────────────

const REVIEWS_FILE = () => path.join(process.cwd(), '.aiox', 'reviews.json');

const HELP_TEXT = `
REVIEW REQUEST MANAGER

USAGE:
  aiox reviews create "<title>" --files "a.js,b.js"     Create a review request
  aiox reviews create "<title>" --reviewer "name"        With reviewer
  aiox reviews list                                      List pending reviews
  aiox reviews list --format json                        List as JSON
  aiox reviews complete <id> --verdict approve           Approve a review
  aiox reviews complete <id> --verdict reject            Reject a review
  aiox reviews stats                                     Show review metrics
  aiox reviews stats --format json                       Metrics as JSON
  aiox reviews --help                                    Show this help

EXAMPLES:
  aiox reviews create "API endpoint review" --files "api.js,routes.js"
  aiox reviews list
  aiox reviews complete abc123 --verdict approve
  aiox reviews stats
`.trim();

// ── Store Operations ─────────────────────────────────────────────────────────

function loadReviews() {
  const filePath = REVIEWS_FILE();
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveReviews(reviews) {
  const filePath = REVIEWS_FILE();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(reviews, null, 2), 'utf8');
}

function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

// ── Commands ─────────────────────────────────────────────────────────────────

function createReview(title, args) {
  if (!title) {
    console.error('Error: title is required. Usage: aiox reviews create "<title>" --files "a.js,b.js"');
    return null;
  }

  const filesRaw = extractFlag(args, '--files') || '';
  const files = filesRaw ? filesRaw.split(',').map(f => f.trim()).filter(Boolean) : [];
  const reviewer = extractFlag(args, '--reviewer') || '';

  const review = {
    id: generateId(),
    title,
    files,
    reviewer,
    status: 'pending',
    verdict: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  const reviews = loadReviews();
  reviews.push(review);
  saveReviews(reviews);

  console.log(`Review created: ${review.id} — ${review.title}`);
  return review;
}

function listReviews(args) {
  const reviews = loadReviews();
  const format = extractFlag(args, '--format');

  if (reviews.length === 0) {
    if (format === 'json') {
      console.log('[]');
    } else {
      console.log('No reviews found.');
    }
    return [];
  }

  if (format === 'json') {
    console.log(JSON.stringify(reviews, null, 2));
    return reviews;
  }

  console.log(`\nReviews (${reviews.length}):\n`);
  for (const r of reviews) {
    const status = r.status === 'pending' ? 'PENDING' : r.verdict ? r.verdict.toUpperCase() : 'DONE';
    console.log(`  ${r.id}  [${status}] ${r.title}`);
  }
  console.log('');

  return reviews;
}

function completeReview(id, args) {
  if (!id) {
    console.error('Error: id is required. Usage: aiox reviews complete <id> --verdict approve|reject');
    return null;
  }

  const verdict = extractFlag(args, '--verdict');
  if (!verdict || !['approve', 'reject'].includes(verdict)) {
    console.error('Error: --verdict must be "approve" or "reject".');
    return null;
  }

  const reviews = loadReviews();
  const review = reviews.find(r => r.id === id);

  if (!review) {
    console.error(`Review not found: ${id}`);
    return null;
  }

  review.status = 'completed';
  review.verdict = verdict;
  review.completedAt = new Date().toISOString();
  saveReviews(reviews);

  console.log(`Review ${id} completed: ${verdict}`);
  return review;
}

function reviewStats(args) {
  const reviews = loadReviews();
  const format = extractFlag(args, '--format');

  const total = reviews.length;
  const pending = reviews.filter(r => r.status === 'pending').length;
  const completed = reviews.filter(r => r.status === 'completed').length;
  const approved = reviews.filter(r => r.verdict === 'approve').length;
  const rejected = reviews.filter(r => r.verdict === 'reject').length;

  // Calculate average completion time
  let avgTimeMs = 0;
  const completedReviews = reviews.filter(r => r.completedAt && r.createdAt);
  if (completedReviews.length > 0) {
    const totalMs = completedReviews.reduce((sum, r) => {
      return sum + (new Date(r.completedAt).getTime() - new Date(r.createdAt).getTime());
    }, 0);
    avgTimeMs = totalMs / completedReviews.length;
  }

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const avgTimeHours = Math.round(avgTimeMs / (1000 * 60 * 60) * 10) / 10;

  const stats = {
    total,
    pending,
    completed,
    approved,
    rejected,
    completionRate,
    avgTimeHours,
  };

  if (format === 'json') {
    console.log(JSON.stringify(stats, null, 2));
    return stats;
  }

  console.log('\nReview Statistics:\n');
  console.log(`  Total:           ${total}`);
  console.log(`  Pending:         ${pending}`);
  console.log(`  Completed:       ${completed}`);
  console.log(`  Approved:        ${approved}`);
  console.log(`  Rejected:        ${rejected}`);
  console.log(`  Completion Rate: ${completionRate}%`);
  console.log(`  Avg Time:        ${avgTimeHours}h`);
  console.log('');

  return stats;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractFlag(args, flag) {
  if (!args) return null;
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

// ── Runner ───────────────────────────────────────────────────────────────────

function runReviews(args) {
  const sub = args[0];

  if (!sub || sub === '--help' || sub === '-h') {
    if (args.includes('--format')) {
      return listReviews(args);
    }
    console.log(HELP_TEXT);
    return;
  }

  switch (sub) {
    case 'create':
      return createReview(args[1], args.slice(2));
    case 'list':
      return listReviews(args.slice(1));
    case 'complete':
      return completeReview(args[1], args.slice(2));
    case 'stats':
      return reviewStats(args.slice(1));
    default:
      console.error(`Unknown reviews subcommand: ${sub}`);
      console.log('Run "aiox reviews --help" for usage.');
      break;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runReviews,
  loadReviews,
  saveReviews,
  createReview,
  listReviews,
  completeReview,
  reviewStats,
  generateId,
  HELP_TEXT,
};
