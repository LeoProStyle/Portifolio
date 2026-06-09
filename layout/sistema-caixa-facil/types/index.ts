export type Role = 'admin' | 'operador';

export type PaymentMethod = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito';

export type CashClosureStatus = 'aberto' | 'fechado';

export type ExpenseCategory =
  | 'Mercadorias'
  | 'Bebidas'
  | 'Energia'
  | 'Água'
  | 'Internet'
  | 'Aluguel'
  | 'Funcionários'
  | 'Outros'
  | 'Relatórios'
  | 'Diário';

export type FiscalStatus =
  | 'Pendente'
  | 'Autorizada'
  | 'Rejeitada'
  | 'Cancelada'
  | 'Futuro Fluxo Fiscal';

export type FiscalDocumentType = 'NFC-e' | 'DANFE' | 'Cupom Simples';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt?: string;
  updatedAt?: string;
}

export interface CashClosure {
  id: string;
  date: string; // YYYY-MM-DD
  dinheiro: number;
  pix: number;
  cartao_credito: number;
  cartao_debito: number;
  total: number; // dinheiro + pix + cartao_credito + cartao_debito
  observacao?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  description: string;
  amount: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ProductCategory = 'Pão de Queijo' | 'Bebidas' | 'Salgados' | 'Doces' | 'Outros';

export interface Product {
  id: string;
  code: string;
  name: string;
  category: ProductCategory;
  salePrice: number;
  cost: number;
  stockCurrent: number;
  stockMin: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CertificateA1 {
  pfxUploadRef?: string; // futura referência de storage (não armazenar PFX no celular)
  certificateName?: string;
  validUntil?: string; // YYYY-MM-DD
  environment?: 'producao' | 'homologacao';
}

export interface FiscalConfig {
  id: string;
  cnpj: string;
  razaoSocial: string;
  inscricaoEstadual?: string;
  taxRegime?: string; // manter flexível para o futuro
  environment?: 'producao' | 'homologacao';
  certificate?: CertificateA1;
  createdAt?: string;
  updatedAt?: string;
}

export interface FiscalDocument {
  id: string;
  number?: string;
  series?: string;
  key?: string;
  protocol?: string;
  status: FiscalStatus;
  type: FiscalDocumentType;
  payloadXml?: string;
  issuedAt?: string;
  updatedAt?: string;
}

