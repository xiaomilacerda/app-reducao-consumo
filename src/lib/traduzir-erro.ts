/**
 * Traduz mensagens conhecidas de autenticação e rede para pt-BR.
 * Mensagens desconhecidas não são exibidas diretamente para evitar
 * vazamento de detalhes técnicos ou textos em outros idiomas.
 */
const AUTH_MESSAGES: Record<string, string> = {
  'user already registered': 'Este e-mail já está cadastrado. Entre na sua conta ou use outro e-mail.',
  'email already registered': 'Este e-mail já está cadastrado. Entre na sua conta ou use outro e-mail.',
  'a user with this email address has already been registered': 'Este e-mail já está cadastrado. Entre na sua conta ou use outro e-mail.',
  'invalid login credentials': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
  'email not confirmed': 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada e a pasta de spam.',
  'email address not confirmed': 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada e a pasta de spam.',
  'signup is disabled': 'O cadastro está temporariamente indisponível.',
  'email signups are disabled': 'O cadastro por e-mail está temporariamente indisponível.',
  'new password should be different from the old password': 'A nova senha precisa ser diferente da anterior.',
  'password should be at least 6 characters': 'Sua senha precisa ter pelo menos 6 caracteres.',
  'password is too weak': 'Escolha uma senha mais forte para sua segurança.',
  'weak password': 'Escolha uma senha mais forte para sua segurança.',
  'invalid email': 'Digite um endereço de e-mail válido.',
  'email address is invalid': 'Digite um endereço de e-mail válido.',
  'email rate limit exceeded': 'Muitas tentativas de envio de e-mail. Aguarde alguns minutos e tente novamente.',
  'for security purposes, you can only request this after': 'Por segurança, aguarde alguns instantes antes de tentar novamente.',
  'over_email_send_rate_limit': 'Muitas tentativas de envio. Aguarde alguns minutos e tente novamente.',
  'over_request_rate_limit': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'too many requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'request rate limit reached': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'network request failed': 'Falha na conexão. Verifique sua internet e tente novamente.',
  'failed to fetch': 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.',
  'jwt expired': 'Sua sessão expirou. Entre novamente.',
  'session expired': 'Sua sessão expirou. Entre novamente.',
  'refresh token not found': 'Sua sessão expirou. Entre novamente.',
  'invalid refresh token': 'Sua sessão expirou. Entre novamente.',
  'same_password': 'A nova senha precisa ser diferente da anterior.',
  'email_exists': 'Este e-mail já está cadastrado. Entre na sua conta ou use outro e-mail.',
  'user_already_exists': 'Este e-mail já está cadastrado. Entre na sua conta ou use outro e-mail.',
  'invalid_credentials': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
  'email_not_confirmed': 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada e a pasta de spam.',
};

type ErrorLike = { message?: string; code?: string; status?: number } | string | null | undefined;

export function traduzirErro(error: ErrorLike, fallback = 'Não foi possível concluir esta operação. Tente novamente.'): string {
  if (!error) return fallback;
  const raw = typeof error === 'string' ? error : error.message ?? '';
  const code = typeof error === 'string' ? '' : error.code ?? '';
  const normalizedCode = code.trim().toLowerCase();
  const normalized = raw.trim().toLowerCase();

  if (AUTH_MESSAGES[normalizedCode]) return AUTH_MESSAGES[normalizedCode];
  if (AUTH_MESSAGES[normalized]) return AUTH_MESSAGES[normalized];

  if (/already (registered|exists)|already been registered|email_exists/.test(normalized)) return AUTH_MESSAGES['user already registered'];
  if (/invalid (login|credentials)|incorrect (email|password)/.test(normalized)) return AUTH_MESSAGES['invalid login credentials'];
  if (/email.*not confirmed/.test(normalized)) return AUTH_MESSAGES['email not confirmed'];
  if (/rate limit|too many requests|try again in \d+ seconds/i.test(normalized)) return AUTH_MESSAGES['too many requests'];
  if (/password.*(least|short|weak)/.test(normalized)) return AUTH_MESSAGES['password is too weak'];
  if (/failed to fetch|network|fetch failed|timed out/i.test(normalized)) return AUTH_MESSAGES['failed to fetch'];
  if (/jwt|refresh token|session.*expired/.test(normalized)) return AUTH_MESSAGES['session expired'];

  // Preserve already-localized app messages, but avoid exposing English server diagnostics.
  if (/[áàãâéêíóôõúç]/i.test(raw) && !/\b(error|failed|invalid|unauthorized|forbidden)\b/i.test(raw)) {
    return raw;
  }
  return fallback;
}
