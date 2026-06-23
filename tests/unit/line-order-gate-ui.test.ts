import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(resolve(process.cwd(), 'app/pages/line/order-gate.vue'), 'utf8');
const liffSource = readFileSync(resolve(process.cwd(), 'app/utils/line-liff.ts'), 'utf8');

describe('LINE order gate UI contract', () => {
  it('renders all MVP states without exposing customer-sensitive fields', () => {
    for (const stateText of [
      '綁定 LINE 接收通知',
      '此 QR 的 LINE 綁定程序已完成',
      '綁定連結已過期',
      '綁定連結已失效',
      '無效的綁定連結',
      '已完成 LINE 綁定',
      '請聯絡店家協助解除舊綁定並重新發卡',
      'LINE 服務暫時無法使用',
      '綁定流程未啟動',
      'LIFF 初始化失敗',
      '查詢維修進度',
      '仍需輸入工單號與完整手機號碼',
      'LINE debug',
      'tokenSource',
      'tokenPreview',
      'resolvedTokenLength',
      'bindClickStarted',
      'bindClickDryRun',
      'bindButtonTag',
      'bindButtonHref',
      'bindButtonClosestAnchorHref',
      'bindButtonFormAction',
      'bindButtonFormMethod',
      'clickEventDefaultPreventedBefore',
      'clickEventDefaultPreventedAfter',
      'bindClickTokenExists',
      'bindClickTokenLength',
      'bindClickTokenPreview',
      'bindClickDebugEnabled',
      'beforeLiffLogin',
      'hasHashAccessToken',
      'hasHashIdToken',
      'hasLiffHashAccessToken',
      'hasLiffHashIdToken',
      'usedHashIdTokenFallback',
      'liffInitState',
      'computed loginRedirectUri',
      'actualLoginRedirectUriMasked',
      'loginRedirectUriHasTokenValue',
      'loginRedirectUriHost',
      'loginRedirectUriPath',
      'loginRedirectUriSearchKeys',
      'redirectReason',
      'beforeNavigateTo',
      'navigateToTargetMasked',
      'beforeLocationAssign',
      'locationAssignTargetMasked',
      'nextAction.callLiffInit',
      'nextAction.callLiffLogin',
      'nextAction.callGetIDToken',
      'nextAction.callConfirmAPI',
      'confirmApiCalled',
      'confirmApiStatus',
      'confirmApiErrorCode',
      '正在初始化 LINE...',
      'isLiffPrimaryRedirect',
      'hasLiffState',
      'mountedAction',
      'mountedLiffInitStarted',
      'mountedLiffInitFinished',
      'mountedSecondaryRedirectExpected',
      'mountedManualSecondaryRedirectTargetMasked',
      'mountedManualSecondaryRedirectReason',
      'resolvedPhase',
      'skippedResolveBecausePrimaryRedirect',
    ]) {
      expect(pageSource).toContain(stateText);
    }
    expect(pageSource).not.toContain('customer.phone');
    expect(pageSource).not.toContain('customer.name');
    expect(pageSource).not.toContain('line_user_id');
    expect(pageSource).not.toContain('LINE_CHANNEL_ACCESS_TOKEN');
    expect(pageSource).not.toContain('LINE_CHANNEL_SECRET');
  });

  it('does not automatically redirect to repair status after binding', () => {
    expect(pageSource).not.toMatch(/navigateTo\(['"]\/repair-status/);
    expect(pageSource).not.toMatch(/router\.(push|replace)\(['"]\/repair-status/);
  });

  it('uses LIFF tokens only in memory and never sends a client user ID', () => {
    expect(liffSource).toContain('liff.init');
    expect(liffSource).toContain('liff.login');
    expect(liffSource).toContain('liff.getIDToken');
    expect(liffSource).toContain('liff.getAccessToken');
    expect(liffSource).toContain("new URL('/line/order-gate'");
    expect(liffSource).toContain("url.searchParams.set('t'");
    expect(liffSource).toContain("url.searchParams.set('debug'");
    expect(liffSource).toContain('buildOrderGateUrl');
    expect(liffSource).not.toContain('window.location.href');
    expect(liffSource).not.toContain('localStorage');
    expect(liffSource).not.toContain('sessionStorage');
    expect(liffSource).not.toContain('getProfile');
    expect(pageSource).toContain('getLineLiffTokens(');
    expect(pageSource).toContain('extractLiffTokensFromHash(window.location.hash)');
    expect(pageSource).toContain('config.public.liffId');
    expect(pageSource).toContain('resolvedToken.value');
    expect(pageSource).toContain('const handleBindClick = async (event?: Event) =>');
    expect(pageSource).toContain('debugState.bindClickStarted = true');
    expect(pageSource).toContain('@click.prevent.stop="handleBindClick"');
    expect(pageSource).toContain('type="button"');
    expect(pageSource).toContain('event?.preventDefault()');
    expect(pageSource).toContain('event?.stopPropagation()');
    expect(pageSource).toContain('buildOrderGateUrl(');
    expect(pageSource).toContain('bind_missing_resolved_token');
    expect(pageSource).toContain('before_hash_id_token_confirm');
    expect(pageSource).toContain('canUseDebugHashTokenFallback');
    expect(pageSource).toContain('confirmLineBinding(bindToken');
    expect(pageSource).toContain('body: { token: bindToken, ...tokens }');
    expect(pageSource).toContain('dry_run_ready');
    expect(pageSource).toContain('dryRunEnabled.value');
    expect(pageSource).toContain('debugVisible');
    expect(pageSource).toContain('lastClickDebugRows.value.length > 0');
    expect(pageSource).toContain('initLineLiff');
    expect(pageSource).toContain('handleLiffPrimaryRedirect');
    expect(pageSource).toContain('syncMountedDebugState');
    expect(pageSource).toContain('isLiffPrimaryRedirect');
    expect(pageSource).toContain('skippedResolveBecausePrimaryRedirect');
    expect(pageSource).not.toContain('route.query.t)');
    expect(pageSource).toContain('redirectOrigin: statusOrigin()');
    expect(pageSource).not.toContain('lineUserId');
  });

  it('keeps debug observability production-safe during the LIFF click flow', () => {
    for (const diagnostic of [
      'before_liff_import',
      'before_liff_init',
      'after_liff_init',
      'before_is_logged_in',
      'before_liff_login',
      'liff_login_redirect',
      'liff_logged_in_mismatch',
      'before_get_id_token',
      'after_get_id_token',
      'before_confirm_api',
      'after_confirm_api',
      'LIFF_LOGGED_IN_MISMATCH',
      'LIFF_ID_TOKEN_MISSING',
      'LIFF_INIT_FAILED',
      'MISSING_RESOLVED_TOKEN',
      'access_token',
      'id_token',
      'context_token',
      'feature_token',
      'mst_challenge',
    ]) {
      expect(`${pageSource}\n${liffSource}`).toContain(diagnostic);
    }

    expect(pageSource).toContain('maskSearchParams');
    expect(pageSource).toContain("params.set(key, '[masked]')");
    expect(pageSource).toContain('sessionStorage.setItem(clickDebugStorageKey');
    expect(pageSource).toContain('sessionStorage.getItem(clickDebugStorageKey');
    expect(pageSource).toContain('computedLoginRedirectUriMasked');
    expect(pageSource).toContain('actualLoginRedirectUriMasked');
    expect(pageSource).toContain('navigateToTargetMasked');
    expect(pageSource).toContain('locationAssignTargetMasked');
    expect(pageSource).toContain('bindButtonClosestAnchorHref');
    expect(pageSource).toContain('bindButtonFormAction');
    expect(pageSource).toContain('clickEventDefaultPreventedAfter');
    expect(pageSource).toContain('lastClick.');
    expect(pageSource).toContain('nextActionCallLiffLogin');
    expect(pageSource).toContain('nextActionCallGetIdToken');
    expect(pageSource).toContain('nextActionCallLiffInit');
    expect(pageSource).toContain('nextActionCallConfirmApi');
    expect(pageSource).toContain('usedHashIdTokenFallback');
    expect(pageSource).not.toContain('sessionStorage.setItem(clickDebugStorageKey, bindToken');
    expect(pageSource).not.toContain('sessionStorage.setItem(clickDebugStorageKey, token');
    expect(pageSource).not.toContain('sessionStorage.setItem(clickDebugStorageKey, idToken');
    expect(pageSource).not.toContain('sessionStorage.setItem(clickDebugStorageKey, accessToken');
    expect(pageSource).not.toContain('raw profile');
    expect(pageSource).not.toContain('LINE_CHANNEL_ACCESS_TOKEN');
    expect(pageSource).not.toContain('LINE_CHANNEL_SECRET');
  });

  it('does not contain a LIFF-base login redirect branch', () => {
    expect(liffSource).toContain('liff.login({ redirectUri })');
    expect(liffSource).toContain("new URL('/line/order-gate'");
    expect(liffSource).not.toContain('new URL(`https://liff.line.me');
    expect(liffSource).not.toContain('createUrlBy');
    expect(liffSource).not.toContain('permanentLink');
    expect(liffSource).not.toContain('liff.login()');
    expect(liffSource).not.toContain('?t`');
    expect(liffSource).not.toContain('?t=');
  });

  it('does not navigate the order-gate page to an empty token URL before confirm', () => {
    expect(pageSource).not.toContain('navigateTo(');
    expect(pageSource).not.toContain('router.push');
    expect(pageSource).not.toContain('router.replace');
    expect(pageSource).not.toContain('location.assign');
    expect(pageSource).toContain('window.location.replace(target)');
    expect(pageSource).toContain('const target = buildOrderGateUrl(candidateToken');
    expect(pageSource).not.toContain('location.href =');
    expect(pageSource).not.toContain("query: { t: ''");
    expect(pageSource).not.toContain('query: { t: undefined');
    expect(pageSource).not.toContain('/line/order-gate?t');
  });

  it('initializes LIFF during primary redirect before token resolve or showing the bind button', () => {
    const primaryBranchIndex = pageSource.indexOf('if (isLiffPrimaryRedirect.value)');
    const primaryHandlerIndex = pageSource.indexOf(
      'void handleLiffPrimaryRedirect()',
      primaryBranchIndex,
    );
    const resolveCallIndex = pageSource.indexOf('void resolveToken()', primaryBranchIndex);
    const initCallIndex = pageSource.indexOf('await initLineLiff(config.public.liffId');
    const resolveApiIndex = pageSource.indexOf("'/api/public/line-bind/resolve'");
    const pendingTemplateIndex = pageSource.indexOf('v-else-if="state === \'pending\'"');

    expect(primaryBranchIndex).toBeGreaterThan(-1);
    expect(primaryHandlerIndex).toBeGreaterThan(primaryBranchIndex);
    expect(resolveCallIndex).toBeGreaterThan(primaryHandlerIndex);
    expect(initCallIndex).toBeGreaterThan(-1);
    expect(initCallIndex).toBeLessThan(resolveApiIndex);
    expect(pageSource).toContain("debugState.skippedResolveBecausePrimaryRedirect = 'true'");
    expect(pageSource).toContain("debugState.mountedAction = 'primary_liff_init'");
    expect(pageSource).toContain("debugState.mountedSecondaryRedirectExpected = 'true'");
    expect(pageSource).toContain("state.value = 'loading'");
    expect(pendingTemplateIndex).toBeGreaterThan(resolveApiIndex);
  });

  it('manual secondary redirect can only use a non-empty parsed token and canonical order-gate URL', () => {
    const candidateIndex = pageSource.indexOf(
      'const candidateToken = normalizeLineOrderGateTokenValue(token.value)',
    );
    const missingGuardIndex = pageSource.indexOf('if (!candidateToken)', candidateIndex);
    const targetIndex = pageSource.indexOf(
      'const target = buildOrderGateUrl(candidateToken, debugEnabled.value, statusOrigin())',
      missingGuardIndex,
    );
    const replaceIndex = pageSource.indexOf('window.location.replace(target)', targetIndex);

    expect(candidateIndex).toBeGreaterThan(-1);
    expect(missingGuardIndex).toBeGreaterThan(candidateIndex);
    expect(targetIndex).toBeGreaterThan(missingGuardIndex);
    expect(replaceIndex).toBeGreaterThan(targetIndex);
    expect(pageSource).toContain('debugState.mountedManualSecondaryRedirectReason');
    expect(pageSource).toContain('liff_init_finished_without_secondary_redirect');
    expect(pageSource).toContain('mountedManualSecondaryRedirectTarget');
    expect(liffSource).toContain('if (!normalizedToken) throw new Error');
    expect(liffSource).toContain("url.searchParams.set('t', normalizedToken)");
  });

  it('keeps the bind action as a plain button without link or form navigation', () => {
    const pendingTemplateIndex = pageSource.indexOf('v-else-if="state === \'pending\'"');
    const bindButtonIndex = pageSource.indexOf('@click.prevent.stop="handleBindClick"');
    const successActionsIndex = pageSource.indexOf(
      "v-if=\"state !== 'loading' && state !== 'pending'\"",
    );
    const pendingBlock = pageSource.slice(pendingTemplateIndex, successActionsIndex);

    expect(pendingTemplateIndex).toBeGreaterThan(-1);
    expect(bindButtonIndex).toBeGreaterThan(pendingTemplateIndex);
    expect(pendingBlock).toContain('type="button"');
    expect(pendingBlock).toContain('@click.prevent.stop="handleBindClick"');
    expect(pendingBlock).not.toContain('<NuxtLink');
    expect(pendingBlock).not.toContain('<RouterLink');
    expect(pendingBlock).not.toContain('<a ');
    expect(pendingBlock).not.toContain('href=');
    expect(pendingBlock).not.toContain('<form');
  });

  it('uses the resolved token for binding and only falls back to hash id token after SDK token failure in debug mode', () => {
    const bindTokenIndex = pageSource.indexOf(
      'const bindToken = normalizeLineOrderGateTokenValue(resolvedToken.value)',
    );
    const sdkFlowIndex = pageSource.indexOf('getLineLiffTokens(', bindTokenIndex);
    const fallbackGuardIndex = pageSource.indexOf('canUseDebugHashTokenFallback');
    const fallbackConfirmIndex = pageSource.indexOf(
      'confirmWithDebugHashTokenFallback(bindToken, hashTokens)',
      sdkFlowIndex,
    );

    expect(bindTokenIndex).toBeGreaterThan(-1);
    expect(sdkFlowIndex).toBeGreaterThan(bindTokenIndex);
    expect(fallbackGuardIndex).toBeGreaterThan(-1);
    expect(fallbackConfirmIndex).toBeGreaterThan(sdkFlowIndex);
    expect(pageSource).toContain('debugEnabled.value &&');
    expect(pageSource).toContain("code === 'LIFF_ID_TOKEN_MISSING'");
    expect(pageSource).toContain("code === 'LIFF_LOGGED_IN_MISMATCH'");
    expect(pageSource).toContain("debugState.nextActionCallLiffInit = 'attempted'");
    expect(pageSource).toContain("debugState.nextActionCallGetIdToken = 'failed'");
    expect(pageSource).not.toContain('line_user_id');
    expect(pageSource).not.toContain('getProfile');
  });
});
