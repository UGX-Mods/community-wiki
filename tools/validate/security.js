/**
 * Security validation: only allow-listed iframes
 */
const { readPage } = require('../lib/pages');
const { parseHtmlContent } = require('../lib/html');

const REGEX_ALLOWED_IFRAME_HOSTS = /^https:\/\/(www.youtube-nocookie.com)/i;

/**
 * @param {string} fileContent
 * @returns {object[]} issues
 */
function checkPageSecurity(fileContent) {
  const issues = [];

  for (const iframe of parseHtmlContent(fileContent).querySelectorAll(
    'iframe',
  )) {
    const src = iframe.getAttribute('src');

    if (!src) {
      issues.push({
        issue: 'Invalid src attribute!',
        reason: 'Missing src or empty!',
      });
    } else if (!src.startsWith('https://')) {
      issues.push({ issue: 'Insecure URL', reason: 'Missing https://', src });
    } else if (!REGEX_ALLOWED_IFRAME_HOSTS.test(src)) {
      issues.push({
        issue: 'Secure hostname check failed!',
        reason: 'URL not in allowed lists of hosts!',
        src,
      });
    }
  }

  return issues;
}

/**
 * @param {string[]} files
 * @returns {Promise<number>} amount of errors
 */
async function securityValidation(files) {
  let securityIssues = 0;
  for (const filePath of files) {
    const fileContent = await readPage(filePath);
    if (!fileContent) continue;

    const issues = checkPageSecurity(fileContent);
    if (issues.length > 0) {
      securityIssues += issues.length;
      console.error(
        '## File',
        filePath,
        'has',
        issues.length,
        'security issues!',
      );
      console.error(issues);
    }
  }

  if (securityIssues > 0) {
    console.error('🚨🚨🚨🚨 Found', securityIssues, 'security issues!');
  }

  return securityIssues;
}

module.exports = { checkPageSecurity, securityValidation };
