<script setup lang="ts">
import { DEFAULT_ADMIN_REDIRECT, sanitizeAdminRedirect } from '~/utils/admin-session';

useHead({
  title: 'Admin Login | BoardsReborn',
});

const route = useRoute();
const adminSession = useAdminSession();
const redirectTarget = computed(() => sanitizeAdminRedirect(route.query.redirect));
const form = reactive({
  email: '',
  password: '',
});
const isSubmitting = ref(false);
const errorMessage = ref('');

const getSubmittedCredential = (
  formElement: HTMLFormElement | null,
  fieldName: 'email' | 'password',
  fallbackValue: string,
) => {
  if (!formElement) {
    return fallbackValue.trim();
  }

  const submittedValue = new FormData(formElement).get(fieldName);
  return typeof submittedValue === 'string' && submittedValue.trim() !== ''
    ? submittedValue.trim()
    : fallbackValue.trim();
};

const sessionSnapshot = await adminSession.refreshAdminSession();

if (sessionSnapshot.status === 'admin') {
  await navigateTo(redirectTarget.value);
}

if (sessionSnapshot.status === 'forbidden') {
  await navigateTo('/forbidden');
}

const handleSubmit = async (event: SubmitEvent) => {
  errorMessage.value = '';
  isSubmitting.value = true;
  const formElement = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : null;
  const submittedEmail = getSubmittedCredential(formElement, 'email', form.email);
  const submittedPassword = getSubmittedCredential(formElement, 'password', form.password);

  form.email = submittedEmail;
  form.password = submittedPassword;

  const error = await adminSession.signInWithPassword(submittedEmail, submittedPassword);

  if (error) {
    errorMessage.value = '登入失敗，請檢查帳號密碼。';
    isSubmitting.value = false;
    return;
  }

  let refreshedSession: Awaited<ReturnType<typeof adminSession.refreshAdminSession>> | null = null;

  try {
    refreshedSession = await adminSession.refreshAdminSession({ force: true });
  } catch {
    errorMessage.value = '登入狀態驗證失敗，請稍後再試。';
    isSubmitting.value = false;
    return;
  }

  if (!refreshedSession) {
    errorMessage.value = '登入狀態驗證失敗，請稍後再試。';
    isSubmitting.value = false;
    return;
  }

  if (refreshedSession.status === 'admin') {
    await navigateTo(redirectTarget.value || DEFAULT_ADMIN_REDIRECT);
    return;
  }

  if (refreshedSession.status === 'forbidden') {
    await navigateTo('/forbidden');
    return;
  }

  errorMessage.value = '登入狀態驗證失敗，請重新登入。';
  isSubmitting.value = false;
};
</script>

<template>
  <div class="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10">
    <Card class="w-full max-w-md" aria-labelledby="login-title">
      <CardHeader>
        <Badge variant="secondary" class="w-fit">BoardsReborn Admin</Badge>
        <CardTitle id="login-title" class="text-2xl">登入管理端</CardTitle>
        <CardDescription>
          使用 Supabase 管理者帳號登入後，才能存取工單管理 API 與後續前端頁面。
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form class="flex flex-col gap-5" @submit.prevent="handleSubmit">
          <FieldGroup>
            <Field>
              <FieldLabel for="email">Email</FieldLabel>
              <Input
                id="email"
                v-model="form.email"
                autocomplete="email"
                inputmode="email"
                name="email"
                required
                type="email"
              />
            </Field>

            <Field>
              <FieldLabel for="password">Password</FieldLabel>
              <Input
                id="password"
                v-model="form.password"
                autocomplete="current-password"
                name="password"
                required
                type="password"
              />
            </Field>
          </FieldGroup>

          <Alert v-if="errorMessage" variant="destructive" role="alert">
            <AlertTitle>登入失敗</AlertTitle>
            <AlertDescription>{{ errorMessage }}</AlertDescription>
          </Alert>

          <Button :disabled="isSubmitting" type="submit" class="w-full">
            <Spinner v-if="isSubmitting" data-icon="inline-start" />
            {{ isSubmitting ? 'Signing in...' : 'Sign in' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
