<script setup lang="ts">
import { AlertCircleIcon, CheckCircle2Icon, ExternalLinkIcon, WavesIcon } from 'lucide-vue-next';
import {
  buildOrderGateUrl,
  extractLiffTokensFromHash,
  getLineLiffTokens,
  initLineLiff,
  type LineLiffTokens,
} from '~/utils/line-liff';
import {
  getLineOrderGateTokenInfo,
  normalizeLineOrderGateTokenValue,
} from '~/utils/line-order-gate-token';

type GateState =
  | 'loading'
  | 'pending'
  | 'used'
  | 'expired'
  | 'revoked'
  | 'invalid'
  | 'success'
  | 'already_linked'
  | 'line_conflict'
  | 'customer_conflict'
  | 'platform_error'
  | 'error';

interface ResolveData {
  canBind: boolean;
  tokenState: 'pending' | 'used' | 'expired' | 'revoked';
  workOrder: { boardType: string; paperOrderNo: string };
}

const route = useRoute();
const config = useRuntimeConfig();
const state = ref<GateState>('loading');
const summary = shallowRef<ResolveData['workOrder'] | null>(null);
const notificationStatus = ref('unknown');
const isBinding = ref(false);
const message = ref('');
const currentUrl = ref('');
const tokenInfo = computed(() => getLineOrderGateTokenInfo(route.query, currentUrl.value));
const token = computed(() => tokenInfo.value.token);
const resolvedToken = ref('');
const repairStatusUrl = '/repair-status';
const officialLineUrl = computed(() => config.public.lineOfficialUrl || '#');
const clickDebugStorageKey = 'boardsreborn:line-order-gate:last-click-debug';
const lastClickDebugRows = ref<Array<[string, string]>>([]);
const debugState = reactive({
  actualLoginRedirectUri: '',
  beforeLiffLogin: '',
  beforeLocationAssign: '',
  beforeNavigateTo: '',
  bindButtonClosestAnchorHref: '',
  bindButtonFormAction: '',
  bindButtonFormMethod: '',
  bindButtonHref: '',
  bindButtonTag: '',
  bindClickDryRun: '',
  bindClickDebugEnabled: '',
  bindClickStarted: false,
  bindClickTokenExists: '',
  bindClickTokenLength: '',
  bindClickTokenPreview: '',
  clickEventDefaultPreventedAfter: '',
  clickEventDefaultPreventedBefore: '',
  confirmApiCalled: false,
  confirmApiErrorCode: '',
  confirmApiStatus: '',
  friendshipPromptResult: '',
  hasHashAccessToken: '',
  hasHashIdToken: '',
  hasLiffState: '',
  isLiffPrimaryRedirect: '',
  isLoggedIn: '',
  lastErrorCode: '',
  lastStep: 'created',
  liffInitState: 'not_started',
  locationAssignTarget: '',
  loginRedirectUri: '',
  mountedAction: '',
  mountedLiffInitFinished: '',
  mountedLiffInitStarted: '',
  mountedManualSecondaryRedirectReason: '',
  mountedManualSecondaryRedirectTarget: '',
  mountedSecondaryRedirectExpected: '',
  navigateToTarget: '',
  nextActionCallConfirmApi: '',
  nextActionCallLiffInit: '',
  nextActionCallGetIdToken: '',
  nextActionCallLiffLogin: '',
  redirectReason: '',
  resolvedPhase: '',
  skippedResolveBecausePrimaryRedirect: '',
  usedHashIdTokenFallback: '',
});

useHead({
  title: 'LINE 綁定 | BoardsReborn',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});

const errorCode = (error: unknown) => {
  if (typeof error !== 'object' || error === null) return null;
  if ('code' in error && typeof error.code === 'string') return error.code;
  const data = 'data' in error ? error.data : null;
  if (typeof data !== 'object' || data === null || !('error' in data)) return null;
  const envelope = data.error;
  return typeof envelope === 'object' && envelope !== null && 'code' in envelope
    ? String(envelope.code)
    : null;
};

const responseStatus = (error: unknown) => {
  if (typeof error !== 'object' || error === null) return '';
  for (const key of ['statusCode', 'status']) {
    if (key in error) {
      const value = error[key as keyof typeof error];
      if (typeof value === 'number' || typeof value === 'string') return String(value);
    }
  }
  const response = 'response' in error ? error.response : null;
  if (typeof response === 'object' && response !== null && 'status' in response) {
    const status = response.status;
    if (typeof status === 'number' || typeof status === 'string') return String(status);
  }
  return '';
};

const previewToken = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.length <= 8 ? 'present' : `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
};

const sensitiveUrlParamKeys = new Set([
  'access_token',
  'context_token',
  'feature_token',
  'id_token',
  'mst_challenge',
]);

const statusOrigin = () => {
  try {
    return new URL(config.public.statusUrl || window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
};

const searchKeys = (value: string) => {
  if (!value) return '';
  try {
    const url = new URL(value, 'https://status.surfboards-reborn.com');
    const keys = Array.from(url.searchParams.keys());
    if (url.hash) {
      const hashValue = url.hash.replace(/^#\/?/, '');
      const hashUrl = new URL(url.hash.slice(1), 'https://status.surfboards-reborn.com');
      keys.push(...Array.from(hashUrl.searchParams.keys()).map((key) => `hash:${key}`));
      if (hashValue.includes('=')) {
        keys.push(...Array.from(new URLSearchParams(hashValue).keys()).map((key) => `hash:${key}`));
      }
    }
    return Array.from(new Set(keys)).join(', ');
  } catch {
    return '';
  }
};

const urlPart = (value: string, part: 'host' | 'path') => {
  if (!value) return '';
  try {
    const url = new URL(value, 'https://status.surfboards-reborn.com');
    return part === 'host' ? url.host : url.pathname;
  } catch {
    return '';
  }
};

const redirectUriHasTokenValue = (value: string) => {
  if (!value) return 'false';
  try {
    return new URL(value).searchParams.get('t')?.trim() ? 'true' : 'false';
  } catch {
    return 'false';
  }
};

const currentHashParams = computed(() => {
  try {
    const url = new URL(currentUrl.value || route.fullPath, 'https://status.surfboards-reborn.com');
    return new URLSearchParams(url.hash.replace(/^#\/?/, ''));
  } catch {
    return new URLSearchParams();
  }
});

const hasLiffHashAccessToken = computed(() => currentHashParams.value.has('access_token'));
const hasLiffHashIdToken = computed(() => currentHashParams.value.has('id_token'));
const hasLiffHashTokens = computed(() => hasLiffHashAccessToken.value || hasLiffHashIdToken.value);

const firstQueryString = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.find((item) => typeof item === 'string') ?? '';
  return '';
};

const hasLiffState = computed(() =>
  Boolean(
    firstQueryString(route.query['liff.state']).trim() ||
    firstQueryString(route.query.liff_state).trim(),
  ),
);
const isLiffPrimaryRedirect = computed(() => hasLiffState.value && hasLiffHashTokens.value);
const resolvedPhase = computed(() => {
  if (isLiffPrimaryRedirect.value) return 'primary';
  return tokenInfo.value.source === 'query.t' ? 'secondary' : 'plain';
});

const hasDebugFlag = (value: string): boolean => {
  if (!value.trim()) return false;
  try {
    const url = new URL(value, 'https://status.surfboards-reborn.com');
    if (url.searchParams.get('debug') === '1') return true;
    if (url.pathname.split('/').filter(Boolean).includes('debug')) return true;
    for (const key of ['liff.state', 'liff_state']) {
      if (hasDebugFlag(url.searchParams.get(key) ?? '')) return true;
    }
    return url.hash ? hasDebugFlag(url.hash.slice(1)) : false;
  } catch {
    try {
      return (
        new URLSearchParams(value.startsWith('?') ? value.slice(1) : value).get('debug') === '1'
      );
    } catch {
      return false;
    }
  }
};

const hasQueryFlag = (name: string, value: string): boolean => {
  if (!value.trim()) return false;
  try {
    const url = new URL(value, 'https://status.surfboards-reborn.com');
    if (url.searchParams.get(name) === '1') return true;
    if (url.pathname.split('/').filter(Boolean).includes(name)) return true;
    for (const key of ['liff.state', 'liff_state']) {
      if (hasQueryFlag(name, url.searchParams.get(key) ?? '')) return true;
    }
    return url.hash ? hasQueryFlag(name, url.hash.slice(1)) : false;
  } catch {
    try {
      return new URLSearchParams(value.startsWith('?') ? value.slice(1) : value).get(name) === '1';
    } catch {
      return false;
    }
  }
};

const debugEnabled = computed(
  () =>
    route.query.debug === '1' ||
    hasDebugFlag(String(route.query['liff.state'] ?? '')) ||
    hasDebugFlag(String(route.query.liff_state ?? '')) ||
    hasDebugFlag(currentUrl.value),
);

const dryRunEnabled = computed(
  () =>
    route.query.dryRun === '1' ||
    hasQueryFlag('dryRun', String(route.query['liff.state'] ?? '')) ||
    hasQueryFlag('dryRun', String(route.query.liff_state ?? '')) ||
    hasQueryFlag('dryRun', currentUrl.value),
);

const loadingDescription = computed(() =>
  isLiffPrimaryRedirect.value || debugState.mountedAction === 'primary_liff_init'
    ? '正在初始化 LINE...'
    : '正在確認綁定連結…',
);

const maskKnownToken = (value: string) => {
  if (!token.value) return value;
  const preview = previewToken(token.value);
  return value
    .split(token.value)
    .join(preview)
    .split(encodeURIComponent(token.value))
    .join(preview);
};

const maskSearchParams = (params: URLSearchParams) => {
  for (const key of sensitiveUrlParamKeys) {
    if (params.has(key)) params.set(key, '[masked]');
  }
  const tokenValue = params.get('t');
  if (tokenValue) params.set('t', previewToken(tokenValue));
  for (const key of ['liff.state', 'liff_state']) {
    const stateValue = params.get(key);
    if (stateValue) params.set(key, maskTokenInUrl(stateValue));
  }
};

const maskTokenInUrl = (value: string) => {
  if (!value) return '';
  try {
    const url = new URL(value, 'https://status.surfboards-reborn.com');
    maskSearchParams(url.searchParams);
    if (url.hash) {
      const hashValue = url.hash.replace(/^#\/?/, '');
      const hashUrl = new URL(url.hash.slice(1), 'https://status.surfboards-reborn.com');
      if (hashUrl.search) {
        maskSearchParams(hashUrl.searchParams);
        url.hash = `${hashUrl.pathname}${hashUrl.search}`;
      } else if (hashValue.includes('=')) {
        const hashParams = new URLSearchParams(hashValue);
        maskSearchParams(hashParams);
        url.hash = `${url.hash.startsWith('#/') ? '/' : ''}${hashParams.toString()}`;
      }
    }
    const masked = value.startsWith('http')
      ? url.toString()
      : `${url.pathname}${url.search}${url.hash}`;
    return maskKnownToken(masked);
  } catch {
    return maskKnownToken(
      value.replace(
        /([?&]t=)[^&#]+/g,
        (_, prefix: string) => `${prefix}${previewToken(token.value)}`,
      ),
    );
  }
};

const debugRows = computed(() => [
  ['currentUrl', maskTokenInUrl(currentUrl.value)],
  ['route.fullPath', maskTokenInUrl(route.fullPath)],
  ['route.query keys', Object.keys(route.query).join(', ') || '(none)'],
  ['tokenSource', tokenInfo.value.source],
  ['tokenExists', token.value ? 'true' : 'false'],
  ['tokenPreview', previewToken(token.value)],
  ['resolvedTokenLength', String(resolvedToken.value.length)],
  ['isLiffPrimaryRedirect', debugState.isLiffPrimaryRedirect],
  ['hasLiffState', debugState.hasLiffState],
  ['hasHashAccessToken', debugState.hasHashAccessToken],
  ['hasHashIdToken', debugState.hasHashIdToken],
  ['mountedAction', debugState.mountedAction],
  ['mountedLiffInitStarted', debugState.mountedLiffInitStarted],
  ['mountedLiffInitFinished', debugState.mountedLiffInitFinished],
  ['mountedSecondaryRedirectExpected', debugState.mountedSecondaryRedirectExpected],
  [
    'mountedManualSecondaryRedirectTargetMasked',
    maskTokenInUrl(debugState.mountedManualSecondaryRedirectTarget),
  ],
  ['mountedManualSecondaryRedirectReason', debugState.mountedManualSecondaryRedirectReason],
  ['resolvedPhase', debugState.resolvedPhase],
  ['skippedResolveBecausePrimaryRedirect', debugState.skippedResolveBecausePrimaryRedirect],
  ['bindClickStarted', String(debugState.bindClickStarted)],
  ['bindClickDryRun', debugState.bindClickDryRun],
  ['bindButtonTag', debugState.bindButtonTag],
  ['bindButtonHref', maskTokenInUrl(debugState.bindButtonHref)],
  ['bindButtonClosestAnchorHref', maskTokenInUrl(debugState.bindButtonClosestAnchorHref)],
  ['bindButtonFormAction', maskTokenInUrl(debugState.bindButtonFormAction)],
  ['bindButtonFormMethod', debugState.bindButtonFormMethod],
  ['clickEventDefaultPreventedBefore', debugState.clickEventDefaultPreventedBefore],
  ['clickEventDefaultPreventedAfter', debugState.clickEventDefaultPreventedAfter],
  ['bindClickTokenExists', debugState.bindClickTokenExists],
  ['bindClickTokenLength', debugState.bindClickTokenLength],
  ['bindClickTokenPreview', debugState.bindClickTokenPreview],
  ['bindClickDebugEnabled', debugState.bindClickDebugEnabled],
  ['beforeLiffLogin', debugState.beforeLiffLogin],
  ['hasLiffHashAccessToken', String(hasLiffHashAccessToken.value)],
  ['hasLiffHashIdToken', String(hasLiffHashIdToken.value)],
  ['usedHashIdTokenFallback', debugState.usedHashIdTokenFallback],
  ['liffInitState', debugState.liffInitState],
  ['isLoggedIn', debugState.isLoggedIn],
  ['computed loginRedirectUri', maskTokenInUrl(debugState.loginRedirectUri)],
  ['actualLoginRedirectUriMasked', maskTokenInUrl(debugState.actualLoginRedirectUri)],
  ['loginRedirectUriHasTokenValue', redirectUriHasTokenValue(debugState.loginRedirectUri)],
  ['loginRedirectUriHost', urlPart(debugState.loginRedirectUri, 'host')],
  ['loginRedirectUriPath', urlPart(debugState.loginRedirectUri, 'path')],
  ['loginRedirectUriSearchKeys', searchKeys(debugState.loginRedirectUri)],
  ['redirectReason', debugState.redirectReason],
  ['beforeNavigateTo', debugState.beforeNavigateTo],
  ['navigateToTargetMasked', maskTokenInUrl(debugState.navigateToTarget)],
  ['beforeLocationAssign', debugState.beforeLocationAssign],
  ['locationAssignTargetMasked', maskTokenInUrl(debugState.locationAssignTarget)],
  ['nextAction.callLiffInit', debugState.nextActionCallLiffInit],
  ['nextAction.callLiffLogin', debugState.nextActionCallLiffLogin],
  ['nextAction.callGetIDToken', debugState.nextActionCallGetIdToken],
  ['nextAction.callConfirmAPI', debugState.nextActionCallConfirmApi],
  ['lastStep', debugState.lastStep],
  ['lastErrorCode', debugState.lastErrorCode],
  ['confirmApiCalled', String(debugState.confirmApiCalled)],
  ['confirmApiStatus', debugState.confirmApiStatus],
  ['confirmApiErrorCode', debugState.confirmApiErrorCode],
  ['friendshipPromptResult', debugState.friendshipPromptResult],
  ...lastClickDebugRows.value,
]);

const debugVisible = computed(() => debugEnabled.value || lastClickDebugRows.value.length > 0);

const persistClickDebug = (extra: Record<string, string> = {}) => {
  try {
    const snapshot = {
      actualLoginRedirectUriMasked: maskTokenInUrl(debugState.actualLoginRedirectUri),
      beforeLiffLogin: debugState.beforeLiffLogin,
      beforeLocationAssign: debugState.beforeLocationAssign,
      beforeNavigateTo: debugState.beforeNavigateTo,
      bindButtonClosestAnchorHref: maskTokenInUrl(debugState.bindButtonClosestAnchorHref),
      bindButtonFormAction: maskTokenInUrl(debugState.bindButtonFormAction),
      bindButtonFormMethod: debugState.bindButtonFormMethod,
      bindButtonHref: maskTokenInUrl(debugState.bindButtonHref),
      bindButtonTag: debugState.bindButtonTag,
      bindClickDryRun: debugState.bindClickDryRun,
      bindClickDebugEnabled: debugState.bindClickDebugEnabled,
      bindClickStarted: String(debugState.bindClickStarted),
      bindClickTokenExists: debugState.bindClickTokenExists,
      bindClickTokenLength: debugState.bindClickTokenLength,
      bindClickTokenPreview: debugState.bindClickTokenPreview,
      clickEventDefaultPreventedAfter: debugState.clickEventDefaultPreventedAfter,
      clickEventDefaultPreventedBefore: debugState.clickEventDefaultPreventedBefore,
      computedLoginRedirectUriMasked: maskTokenInUrl(debugState.loginRedirectUri),
      confirmApiCalled: String(debugState.confirmApiCalled),
      friendshipPromptResult: debugState.friendshipPromptResult,
      hasHashAccessToken: debugState.hasHashAccessToken,
      hasHashIdToken: debugState.hasHashIdToken,
      hasLiffHashAccessToken: String(hasLiffHashAccessToken.value),
      hasLiffHashIdToken: String(hasLiffHashIdToken.value),
      isLoggedInBeforeLogin: debugState.isLoggedIn,
      lastErrorCode: debugState.lastErrorCode,
      lastStep: debugState.lastStep,
      loginRedirectUriHasTokenValue: redirectUriHasTokenValue(debugState.loginRedirectUri),
      loginRedirectUriHost: urlPart(debugState.loginRedirectUri, 'host'),
      loginRedirectUriPath: urlPart(debugState.loginRedirectUri, 'path'),
      loginRedirectUriSearchKeys: searchKeys(debugState.loginRedirectUri),
      locationAssignTargetMasked: maskTokenInUrl(debugState.locationAssignTarget),
      navigateToTargetMasked: maskTokenInUrl(debugState.navigateToTarget),
      nextActionCallConfirmApi: debugState.nextActionCallConfirmApi,
      nextActionCallLiffInit: debugState.nextActionCallLiffInit,
      nextActionCallGetIdToken: debugState.nextActionCallGetIdToken,
      nextActionCallLiffLogin: debugState.nextActionCallLiffLogin,
      redirectReason: debugState.redirectReason,
      usedHashIdTokenFallback: debugState.usedHashIdTokenFallback,
      ...extra,
    };
    sessionStorage.setItem(clickDebugStorageKey, JSON.stringify(snapshot));
    lastClickDebugRows.value = Object.entries(snapshot).map(([key, value]) => [
      `lastClick.${key}`,
      value,
    ]);
  } catch {
    // Debug persistence is best-effort and must not block binding.
  }
};

const restoreClickDebug = () => {
  try {
    const raw = sessionStorage.getItem(clickDebugStorageKey);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    lastClickDebugRows.value = Object.entries(parsed).map(([key, value]) => [
      `lastClick.${key}`,
      typeof value === 'string' ? value : String(value),
    ]);
  } catch {
    lastClickDebugRows.value = [];
  }
};

const confirmLineBinding = async (bindToken: string, tokens: LineLiffTokens) => {
  debugState.confirmApiCalled = true;
  debugState.nextActionCallConfirmApi = 'true';
  debugState.lastStep = 'before_confirm_api';
  persistClickDebug();
  const response = await $fetch<{
    data: {
      binding: { notificationStatus: string };
      outcome: 'already_linked' | 'linked';
      workOrder: { paperOrderNo: string };
    };
  }>('/api/public/line-bind/confirm', {
    body: { token: bindToken, ...tokens },
    method: 'POST',
  });
  debugState.confirmApiStatus = '200';
  debugState.lastStep = 'after_confirm_api';
  persistClickDebug();
  summary.value = { boardType: summary.value?.boardType ?? '', ...response.data.workOrder };
  notificationStatus.value = response.data.binding.notificationStatus;
  state.value = response.data.outcome === 'already_linked' ? 'already_linked' : 'success';
};

const syncMountedDebugState = () => {
  debugState.hasLiffState = String(hasLiffState.value);
  debugState.hasHashAccessToken = String(hasLiffHashAccessToken.value);
  debugState.hasHashIdToken = String(hasLiffHashIdToken.value);
  debugState.isLiffPrimaryRedirect = String(isLiffPrimaryRedirect.value);
  debugState.resolvedPhase = resolvedPhase.value;
};

const handleLiffPrimaryRedirect = async () => {
  state.value = 'loading';
  debugState.mountedAction = 'primary_liff_init';
  debugState.mountedLiffInitStarted = 'true';
  debugState.mountedLiffInitFinished = '';
  debugState.mountedSecondaryRedirectExpected = 'true';
  debugState.skippedResolveBecausePrimaryRedirect = 'true';
  debugState.nextActionCallLiffInit = 'true';
  debugState.nextActionCallGetIdToken = 'false';
  debugState.nextActionCallConfirmApi = 'false';
  debugState.nextActionCallLiffLogin = 'false';
  syncMountedDebugState();

  try {
    await initLineLiff(config.public.liffId, {
      onInitState: (value) => {
        debugState.liffInitState = value;
      },
      onStep: (value) => {
        debugState.lastStep = value;
      },
    });
    debugState.mountedLiffInitFinished = 'true';
  } catch (error) {
    debugState.mountedLiffInitFinished = 'failed';
    debugState.lastErrorCode = errorCode(error) ?? 'UNKNOWN_ERROR';
    state.value = 'error';
    message.value = 'LIFF 初始化失敗，請關閉後重新從 LINE 開啟。';
    return;
  }

  const candidateToken = normalizeLineOrderGateTokenValue(token.value);
  if (!candidateToken) {
    state.value = 'invalid';
    debugState.lastStep = 'primary_missing_token';
    debugState.lastErrorCode = 'TOKEN_MISSING';
    return;
  }

  try {
    const target = buildOrderGateUrl(candidateToken, debugEnabled.value, statusOrigin());
    debugState.mountedManualSecondaryRedirectTarget = target;
    debugState.mountedManualSecondaryRedirectReason =
      'liff_init_finished_without_secondary_redirect';
    debugState.beforeLocationAssign = 'true';
    debugState.locationAssignTarget = target;
    window.location.replace(target);
  } catch (error) {
    state.value = 'invalid';
    debugState.lastStep = 'primary_secondary_redirect_error';
    debugState.lastErrorCode = error instanceof Error ? error.message : 'TOKEN_INVALID';
  }
};

const resolveToken = async () => {
  debugState.lastStep = 'resolve_start';
  const candidateToken = normalizeLineOrderGateTokenValue(token.value);
  if (!candidateToken) {
    state.value = 'invalid';
    debugState.lastStep = 'resolve_missing_token';
    debugState.lastErrorCode = 'TOKEN_MISSING';
    return;
  }

  state.value = 'loading';
  try {
    const response = await $fetch<{ data: ResolveData }>('/api/public/line-bind/resolve', {
      body: { token: candidateToken },
      method: 'POST',
    });
    resolvedToken.value = candidateToken;
    summary.value = response.data.workOrder;
    state.value = response.data.tokenState;
    debugState.lastStep = `resolve_${response.data.tokenState}`;
    debugState.lastErrorCode = '';
  } catch (error) {
    const code = errorCode(error);
    debugState.lastErrorCode = code ?? 'UNKNOWN_ERROR';
    debugState.lastStep = 'resolve_error';
    state.value = code === 'TOKEN_INVALID' ? 'invalid' : 'error';
  }
};

const canUseDebugHashTokenFallback = (code: string | null, hashTokens: Partial<LineLiffTokens>) =>
  debugEnabled.value &&
  Boolean(hashTokens.idToken) &&
  (code === 'LIFF_ID_TOKEN_MISSING' || code === 'LIFF_LOGGED_IN_MISMATCH');

const confirmWithDebugHashTokenFallback = async (
  bindToken: string,
  hashTokens: Partial<LineLiffTokens>,
) => {
  if (!hashTokens.idToken) return false;
  debugState.usedHashIdTokenFallback = 'true';
  debugState.nextActionCallLiffInit = 'attempted';
  debugState.nextActionCallLiffLogin = 'false';
  debugState.nextActionCallGetIdToken = 'failed';
  debugState.nextActionCallConfirmApi = 'true';
  debugState.lastStep = 'before_hash_id_token_confirm';
  persistClickDebug();
  await confirmLineBinding(bindToken, {
    idToken: hashTokens.idToken,
    ...(hashTokens.accessToken ? { accessToken: hashTokens.accessToken } : {}),
  });
  return true;
};

const closestElement = (value: EventTarget | null, selector: string) =>
  value instanceof Element ? value.closest(selector) : null;

const elementHref = (value: EventTarget | null) =>
  value instanceof HTMLAnchorElement ? value.href : '';

const handleBindClick = async (event?: Event) => {
  debugState.bindClickStarted = true;
  const target = event?.target ?? null;
  const currentTarget = event?.currentTarget ?? null;
  const closestAnchor = closestElement(target, 'a');
  const closestForm = closestElement(target, 'form');
  debugState.bindButtonTag = currentTarget instanceof HTMLElement ? currentTarget.tagName : '';
  debugState.bindButtonHref = elementHref(currentTarget);
  debugState.bindButtonClosestAnchorHref =
    closestAnchor instanceof HTMLAnchorElement ? closestAnchor.href : '';
  debugState.bindButtonFormAction =
    closestForm instanceof HTMLFormElement ? closestForm.getAttribute('action') || '' : '';
  debugState.bindButtonFormMethod =
    closestForm instanceof HTMLFormElement ? closestForm.getAttribute('method') || '' : '';
  debugState.clickEventDefaultPreventedBefore = String(event?.defaultPrevented ?? false);
  event?.preventDefault();
  event?.stopPropagation();
  debugState.clickEventDefaultPreventedAfter = String(event?.defaultPrevented ?? false);
  isBinding.value = true;
  message.value = '';
  debugState.beforeLiffLogin = '';
  debugState.beforeLocationAssign = 'false';
  debugState.bindClickDryRun = String(dryRunEnabled.value);
  debugState.confirmApiCalled = false;
  debugState.confirmApiErrorCode = '';
  debugState.confirmApiStatus = '';
  debugState.friendshipPromptResult = '';
  debugState.lastErrorCode = '';
  debugState.lastStep = 'bind_start';
  debugState.actualLoginRedirectUri = '';
  debugState.beforeNavigateTo = 'false';
  debugState.locationAssignTarget = '';
  debugState.navigateToTarget = '';
  debugState.nextActionCallConfirmApi = '';
  debugState.nextActionCallLiffInit = '';
  debugState.nextActionCallGetIdToken = '';
  debugState.nextActionCallLiffLogin = '';
  debugState.redirectReason = '';
  debugState.usedHashIdTokenFallback = '';
  try {
    const bindToken = normalizeLineOrderGateTokenValue(resolvedToken.value);
    const hashTokens = extractLiffTokensFromHash(window.location.hash);
    debugState.bindClickDebugEnabled = String(debugEnabled.value);
    debugState.bindClickTokenExists = bindToken ? 'true' : 'false';
    debugState.bindClickTokenLength = String(bindToken.length);
    debugState.bindClickTokenPreview = previewToken(bindToken);
    debugState.hasHashAccessToken = hashTokens.accessToken ? 'true' : 'false';
    debugState.hasHashIdToken = hashTokens.idToken ? 'true' : 'false';
    debugState.nextActionCallLiffInit = 'true';
    debugState.nextActionCallGetIdToken = 'true';
    debugState.nextActionCallConfirmApi = 'after_get_id_token';
    debugState.nextActionCallLiffLogin = hasLiffHashTokens.value
      ? 'false'
      : 'possible_after_liff_init';
    persistClickDebug();
    if (!bindToken) {
      state.value = 'invalid';
      debugState.lastStep = 'bind_missing_resolved_token';
      debugState.lastErrorCode = 'MISSING_RESOLVED_TOKEN';
      persistClickDebug({ lastErrorCode: debugState.lastErrorCode });
      return;
    }

    debugState.loginRedirectUri = buildOrderGateUrl(bindToken, debugEnabled.value, statusOrigin());
    debugState.redirectReason = 'computed_before_liff_flow';
    debugState.usedHashIdTokenFallback = 'false';
    persistClickDebug();

    if (dryRunEnabled.value) {
      debugState.lastStep = 'dry_run_ready';
      persistClickDebug({ lastStep: debugState.lastStep });
      return;
    }

    let tokens: LineLiffTokens | null = null;
    try {
      tokens = await getLineLiffTokens(
        config.public.liffId,
        bindToken,
        debugEnabled.value
          ? {
              onInitState: (value) => {
                debugState.liffInitState = value;
                persistClickDebug();
              },
              onIsLoggedIn: (value) => {
                debugState.isLoggedIn = String(value);
                debugState.nextActionCallLiffInit = 'true';
                debugState.nextActionCallLiffLogin = value ? 'false' : 'true';
                debugState.nextActionCallGetIdToken = value ? 'true' : 'false';
                debugState.nextActionCallConfirmApi = value ? 'after_get_id_token' : 'false';
                if (!value && (hasLiffHashAccessToken.value || hasLiffHashIdToken.value)) {
                  debugState.lastErrorCode = 'LIFF_LOGGED_IN_MISMATCH';
                  debugState.nextActionCallLiffInit = 'true';
                  debugState.nextActionCallLiffLogin = 'false';
                  debugState.nextActionCallGetIdToken = 'false';
                  debugState.nextActionCallConfirmApi = 'false';
                }
                persistClickDebug();
              },
              onLoginRedirectUri: (value) => {
                debugState.actualLoginRedirectUri = value;
                debugState.loginRedirectUri = value;
                debugState.redirectReason = 'liff_login';
                persistClickDebug();
              },
              onFriendshipPrompt: (value) => {
                debugState.friendshipPromptResult = value;
                persistClickDebug();
              },
              onStep: (value) => {
                debugState.lastStep = value;
                if (value === 'before_liff_login') debugState.beforeLiffLogin = 'true';
                persistClickDebug({ beforeLiffLogin: debugState.beforeLiffLogin });
              },
            }
          : {},
        {
          debug: debugEnabled.value,
          hasLiffHashTokens: hasLiffHashTokens.value,
          redirectOrigin: statusOrigin(),
          requestFriendshipBeforeToken: true,
        },
      );
    } catch (liffError) {
      const code = errorCode(liffError);
      debugState.lastErrorCode = code ?? 'UNKNOWN_ERROR';
      if (canUseDebugHashTokenFallback(code, hashTokens)) {
        const handled = await confirmWithDebugHashTokenFallback(bindToken, hashTokens);
        if (handled) return;
      }
      throw liffError;
    }
    if (!tokens) return;
    await confirmLineBinding(bindToken, tokens);
  } catch (error) {
    const code = errorCode(error);
    debugState.lastErrorCode = code ?? 'UNKNOWN_ERROR';
    debugState.confirmApiErrorCode = code ?? '';
    debugState.confirmApiStatus = responseStatus(error);
    debugState.lastStep = debugState.confirmApiCalled ? 'confirm_api_error' : 'bind_error';
    if (code === 'LINE_ALREADY_BOUND_TO_OTHER_CUSTOMER') state.value = 'line_conflict';
    else if (code === 'CUSTOMER_ALREADY_BOUND_TO_OTHER_LINE') state.value = 'customer_conflict';
    else if (code === 'LINE_PLATFORM_UNAVAILABLE') state.value = 'platform_error';
    else if (code === 'LINE_ID_TOKEN_INVALID' || code === 'LINE_ACCESS_TOKEN_INVALID')
      state.value = 'platform_error';
    else if (code === 'LIFF_INIT_FAILED') {
      state.value = 'error';
      message.value = 'LIFF 初始化失敗，請關閉後重新從 LINE 開啟。';
    } else if (code === 'LIFF_ID_TOKEN_MISSING' || code === 'LIFF_LOGGED_IN_MISMATCH') {
      state.value = 'error';
      message.value = '綁定流程未啟動，請關閉後重新從 LINE 開啟。';
    } else if (code === 'TOKEN_EXPIRED') state.value = 'expired';
    else if (code === 'TOKEN_REVOKED') state.value = 'revoked';
    else if (code === 'TOKEN_USED') state.value = 'used';
    else if (code === 'TOKEN_INVALID') state.value = 'invalid';
    else {
      state.value = 'error';
      message.value = error instanceof Error ? error.message : '綁定失敗，請稍後再試。';
    }
  } finally {
    isBinding.value = false;
  }
};

onMounted(() => {
  currentUrl.value = window.location.href;
  restoreClickDebug();
  syncMountedDebugState();
  if (isLiffPrimaryRedirect.value) {
    void handleLiffPrimaryRedirect();
    return;
  }
  debugState.mountedAction = 'resolve_token';
  debugState.skippedResolveBecausePrimaryRedirect = 'false';
  void resolveToken();
});
</script>

<template>
  <main
    class="min-h-svh bg-[radial-gradient(circle_at_top,_oklch(0.94_0.05_190),_transparent_48%),linear-gradient(to_bottom,_white,_oklch(0.97_0.01_220))] px-4 py-8 sm:py-14"
  >
    <Card class="mx-auto max-w-xl overflow-hidden border-slate-200 shadow-xl shadow-slate-900/5">
      <div class="h-2 bg-gradient-to-r from-cyan-600 via-teal-500 to-amber-400" />
      <CardHeader class="space-y-4 text-center">
        <div
          class="mx-auto flex size-14 items-center justify-center rounded-full bg-cyan-950 text-white"
        >
          <WavesIcon class="size-7" />
        </div>
        <div>
          <Badge variant="secondary">BoardsReborn 板再生</Badge>
          <CardTitle class="mt-3 text-2xl">維修工單 LINE 通知</CardTitle>
          <CardDescription v-if="summary" class="mt-2 text-base">
            工單 {{ summary.paperOrderNo }} · {{ summary.boardType }}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent class="space-y-5">
        <div
          v-if="state === 'loading'"
          class="flex items-center justify-center gap-3 py-10 text-muted-foreground"
        >
          <Spinner /> {{ loadingDescription }}
        </div>

        <template v-else-if="state === 'pending'">
          <Alert
            ><AlertCircleIcon /><AlertTitle>接收維修進度通知</AlertTitle
            ><AlertDescription
              >加入並綁定官方 LINE，後續完工通知會透過 LINE 傳送。</AlertDescription
            ></Alert
          >
          <Button
            type="button"
            class="h-12 w-full text-base"
            :disabled="isBinding"
            @click.prevent.stop="handleBindClick"
          >
            <Spinner v-if="isBinding" />{{ isBinding ? '正在連接 LINE…' : '綁定 LINE 接收通知' }}
          </Button>
        </template>

        <Alert v-else-if="state === 'used'"
          ><CheckCircle2Icon /><AlertTitle>此 QR 的 LINE 綁定程序已完成</AlertTitle
          ><AlertDescription>這組一次性憑證不能再次綁定。</AlertDescription></Alert
        >
        <Alert v-else-if="state === 'expired'" variant="destructive"
          ><AlertCircleIcon /><AlertTitle>綁定連結已過期</AlertTitle
          ><AlertDescription>請聯絡店家重新發卡。</AlertDescription></Alert
        >
        <Alert v-else-if="state === 'revoked'" variant="destructive"
          ><AlertCircleIcon /><AlertTitle>綁定連結已失效</AlertTitle
          ><AlertDescription>請聯絡店家重新發卡。</AlertDescription></Alert
        >
        <Alert v-else-if="state === 'invalid'" variant="destructive"
          ><AlertCircleIcon /><AlertTitle>無效的綁定連結</AlertTitle
          ><AlertDescription>請確認 QR Code 或聯絡店家。</AlertDescription></Alert
        >
        <Alert v-else-if="state === 'success' || state === 'already_linked'"
          ><CheckCircle2Icon /><AlertTitle>已完成 LINE 綁定</AlertTitle
          ><AlertDescription
            >{{
              state === 'already_linked'
                ? '此 LINE 已綁定同一位顧客。'
                : '後續將透過官方 LINE 提供通知。'
            }}
            通知狀態：{{ notificationStatus }}</AlertDescription
          ></Alert
        >
        <Alert
          v-else-if="state === 'line_conflict' || state === 'customer_conflict'"
          variant="destructive"
          ><AlertCircleIcon /><AlertTitle>無法完成綁定</AlertTitle
          ><AlertDescription>請聯絡店家協助解除舊綁定並重新發卡。</AlertDescription></Alert
        >
        <Alert v-else-if="state === 'platform_error'" variant="destructive"
          ><AlertCircleIcon /><AlertTitle>LINE 服務暫時無法使用</AlertTitle
          ><AlertDescription>請稍後重新開啟此頁。</AlertDescription></Alert
        >
        <Alert v-else variant="destructive"
          ><AlertCircleIcon /><AlertTitle>目前無法完成操作</AlertTitle
          ><AlertDescription>{{ message || '請稍後再試或聯絡店家。' }}</AlertDescription></Alert
        >

        <div v-if="state !== 'loading' && state !== 'pending'" class="grid gap-3 sm:grid-cols-2">
          <Button as-child variant="outline"
            ><NuxtLink :to="repairStatusUrl">查詢維修進度</NuxtLink></Button
          >
          <Button as-child
            ><a :href="officialLineUrl" target="_blank" rel="noreferrer"
              >聯絡官方 LINE <ExternalLinkIcon /></a
          ></Button>
        </div>
        <p
          v-if="state === 'success' || state === 'already_linked'"
          class="text-center text-sm text-muted-foreground"
        >
          查詢維修進度時仍需輸入工單號與完整手機號碼。
        </p>

        <div
          v-if="debugVisible"
          data-testid="line-order-gate-debug"
          class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-xs text-amber-950"
        >
          <p class="mb-2 font-semibold">LINE debug</p>
          <dl class="grid gap-1">
            <div v-for="[key, value] in debugRows" :key="key" class="grid gap-1 sm:grid-cols-3">
              <dt class="font-medium">{{ key }}</dt>
              <dd class="break-all sm:col-span-2">{{ value || '(empty)' }}</dd>
            </div>
          </dl>
        </div>
      </CardContent>
    </Card>
  </main>
</template>
