import { describe, expect, it } from "vitest";
import {
  EMAIL_INVALID_MESSAGE,
  WEBSITE_INVALID_MESSAGE,
  getEmailError,
  getWebsiteError,
  isValidEmail,
  isValidWebsite,
  normalizeEmail,
  normalizeWebsite,
} from "../../shared/format/contact";
import {
  PHONE_INVALID_MESSAGE,
  PHONE_MASK_MAX_LENGTH,
  extractPhoneDigits,
  getPhoneError,
  isValidPhone,
  maskPhone,
  maskPhoneInput,
  normalizePhone,
} from "../../shared/format/phone";

// AC-ra-20: phone `(11) 91234-5678` or `(11) 1234-5678`, e-mail and site with their own messages.
describe("maskPhone (AC-ra-20)", () => {
  it.each([
    ["", ""],
    ["1", "(1"],
    ["11", "(11"],
    ["119", "(11) 9"],
    ["11912", "(11) 912"],
    ["119123", "(11) 9123"],
    ["1191234", "(11) 91234"],
    ["11912345", "(11) 91234-5"],
    ["11912345678", "(11) 91234-5678"],
    ["111", "(11) 1"],
    ["111234", "(11) 1234"],
    ["1112345", "(11) 1234-5"],
    ["1112345678", "(11) 1234-5678"],
  ])("masks %s as %s", (typed, expected) => {
    expect(maskPhone(typed)).toBe(expected);
  });

  it("keeps a number that is already masked unchanged", () => {
    expect(maskPhone("(11) 91234-5678")).toBe("(11) 91234-5678");
    expect(maskPhone("(11) 1234-5678")).toBe("(11) 1234-5678");
  });

  it("stops a landline at 10 digits and a mobile at 11", () => {
    expect(maskPhone("111234567899")).toBe("(11) 1234-5678");
    expect(maskPhone("119123456789")).toBe("(11) 91234-5678");
    expect(maskPhone("(11) 91234-5678").length).toBe(PHONE_MASK_MAX_LENGTH);
  });

  it("drops a leading +55 and ignores letters", () => {
    expect(maskPhone("+55 11 91234-5678")).toBe("(11) 91234-5678");
    expect(maskPhone("+55 (11) 1234-5678")).toBe("(11) 1234-5678");
    expect(maskPhone("tel 11x9")).toBe("(11) 9");
  });

  it("answers an empty string for anything that is not text", () => {
    expect(maskPhone(null)).toBe("");
    expect(maskPhone(undefined)).toBe("");
    expect(extractPhoneDigits(null)).toBe("");
  });
});

describe("isValidPhone / getPhoneError (AC-ra-20)", () => {
  it.each(["(11) 91234-5678", "11912345678", "(11) 1234-5678", "1112345678", "+55 11 91234-5678", "(21) 2345-6789"])(
    "accepts %s",
    (value) => {
      expect(isValidPhone(value)).toBe(true);
      expect(getPhoneError(value)).toBeNull();
    },
  );

  it.each([
    "(11) 9123-4567",
    "(11) 91234-567",
    "(11) 1234-567",
    "(11) 12345-6789",
    "(00) 91234-5678",
    "(01) 91234-5678",
    "(11) 01234-5678",
    "(11) 0234-5678",
    "119123456789",
    "(11) 91234-5678 ramal 3",
    "abc",
    "9",
  ])("refuses %s with the format hint", (value) => {
    expect(isValidPhone(value)).toBe(false);
    expect(getPhoneError(value)).toBe(PHONE_INVALID_MESSAGE);
  });

  it("states the format in the message", () => {
    expect(PHONE_INVALID_MESSAGE).toBe("Telefone inválido. Use (11) 91234-5678.");
  });

  it("treats a blank phone as not informed", () => {
    expect(getPhoneError("")).toBeNull();
    expect(getPhoneError("   ")).toBeNull();
    expect(getPhoneError(null)).toBeNull();
    expect(getPhoneError(undefined)).toBeNull();
    expect(isValidPhone(null)).toBe(false);
  });

  it("normalizes a valid phone to the mask and a bad one to null", () => {
    expect(normalizePhone("11912345678")).toBe("(11) 91234-5678");
    expect(normalizePhone("1112345678")).toBe("(11) 1234-5678");
    expect(normalizePhone("1191234")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("maskPhoneInput (AC-ra-20)", () => {
  it("masks typing at the end and keeps the caret at the end", () => {
    expect(maskPhoneInput("(11) 91234-56", 13, "(11) 91234-5")).toEqual({ value: "(11) 91234-56", caret: 13 });
    expect(maskPhoneInput("119", 3, "11")).toEqual({ value: "(11) 9", caret: 6 });
  });

  it("keeps the caret next to the digit typed in the middle", () => {
    // "(11) 91234-5678" with "0" typed after the area code's first digit: the number is no longer a
    // mobile, so it is cut at 10 digits, and the caret stays right after the "0".
    expect(maskPhoneInput("(101) 91234-5678", 3, "(11) 91234-5678")).toEqual({ value: "(10) 1912-3456", caret: 3 });
  });

  it("lets Backspace over a separator remove the digit before it", () => {
    // "(11) 9" with the space deleted: caret sits right after ")" and the second "1" goes away.
    expect(maskPhoneInput("(11)9", 4, "(11) 9")).toEqual({ value: "(19", caret: 2 });
  });

  it("lets Backspace remove the last digit and the separators that came with it", () => {
    expect(maskPhoneInput("(11) ", 5, "(11) 9")).toEqual({ value: "(11", caret: 3 });
  });

  it("does not grow past the mask when more digits are typed", () => {
    expect(maskPhoneInput("(11) 91234-56789", 16, "(11) 91234-5678")).toEqual({
      value: "(11) 91234-5678",
      caret: 15,
    });
  });
});

describe("e-mail (AC-ra-20)", () => {
  it.each([
    "nome@empresa.com.br",
    "ana.souza+relatorios@fitpulse.com",
    "a@b.co",
    "  nome@empresa.com.br  ",
    "NOME@Empresa.com.br",
    "first_last-1@sub.dominio.com.br",
  ])("accepts %s", (value) => {
    expect(isValidEmail(value)).toBe(true);
    expect(getEmailError(value)).toBeNull();
  });

  it("keeps the address as typed, only trimmed", () => {
    expect(normalizeEmail("  Nome@Empresa.com.br ")).toBe("Nome@Empresa.com.br");
  });

  it.each([
    "nome",
    "nome@",
    "@empresa.com.br",
    "nome@empresa",
    "nome@empresa.c",
    "nome@empresa..com",
    "nome@.empresa.com",
    "nome@empresa.com.",
    "nome..sobrenome@empresa.com",
    ".nome@empresa.com",
    "nome@@empresa.com",
    "nome empresa@x.com",
    "nome@-empresa.com",
    "nome@empresa.123",
    `${"a".repeat(65)}@empresa.com`,
    `nome@${"a".repeat(250)}.com`,
  ])("refuses %s with the format hint", (value) => {
    expect(isValidEmail(value)).toBe(false);
    expect(normalizeEmail(value)).toBeNull();
    expect(getEmailError(value)).toBe(EMAIL_INVALID_MESSAGE);
  });

  it("states the format in the message", () => {
    expect(EMAIL_INVALID_MESSAGE).toBe("E-mail inválido. Use nome@empresa.com.br.");
  });

  it("treats a blank e-mail as not informed and never throws", () => {
    expect(getEmailError("")).toBeNull();
    expect(getEmailError("  ")).toBeNull();
    expect(getEmailError(null)).toBeNull();
    expect(getEmailError(undefined)).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(isValidEmail(undefined)).toBe(false);
  });
});

describe("site (AC-ra-20)", () => {
  it.each([
    ["empresa.com.br", "empresa.com.br"],
    ["www.empresa.com.br", "www.empresa.com.br"],
    ["https://empresa.com.br", "empresa.com.br"],
    ["HTTP://Empresa.com.br/", "empresa.com.br"],
    ["https://www.empresa.com.br/loja/planos?ref=pdf#topo", "www.empresa.com.br/loja/planos?ref=pdf#topo"],
    ["  empresa.com.br/Contato  ", "empresa.com.br/Contato"],
    ["empresa.com.br:8080/app", "empresa.com.br:8080/app"],
    ["sub.dominio-novo.com", "sub.dominio-novo.com"],
  ])("accepts %s and shows it as %s", (value, shown) => {
    expect(isValidWebsite(value)).toBe(true);
    expect(getWebsiteError(value)).toBeNull();
    expect(normalizeWebsite(value)).toBe(shown);
  });

  it.each([
    "empresa",
    "empresa.",
    ".com.br",
    "empresa.c",
    "empresa com br",
    "empresa.com.br/uma pagina",
    "javascript:alert(1)",
    "ftp://empresa.com.br",
    "mailto:nome@empresa.com.br",
    "https://",
    "https://usuario@empresa.com.br",
    "empresa.com.br:abc",
    "empresa.com.br:80:80",
    "empresa..com.br",
    "-empresa.com.br",
    "empresa.com.br/<script>",
    `empresa.com.br/${"a".repeat(200)}`,
  ])("refuses %s with the format hint", (value) => {
    expect(isValidWebsite(value)).toBe(false);
    expect(normalizeWebsite(value)).toBeNull();
    expect(getWebsiteError(value)).toBe(WEBSITE_INVALID_MESSAGE);
  });

  it("states the format in the message", () => {
    expect(WEBSITE_INVALID_MESSAGE).toBe("Site inválido. Use empresa.com.br.");
  });

  it("treats a blank site as not informed and never throws", () => {
    expect(getWebsiteError("")).toBeNull();
    expect(getWebsiteError("  ")).toBeNull();
    expect(getWebsiteError(null)).toBeNull();
    expect(getWebsiteError(undefined)).toBeNull();
    expect(normalizeWebsite(null)).toBeNull();
    expect(isValidWebsite(undefined)).toBe(false);
  });
});
