const fs = require('fs');

function escapeXmlText(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function genNumeric(len){ return Array.from({length:len}).map(()=>String(Math.floor(Math.random()*10))).join(''); }

function computeDV(base){
  const pesos = [2,3,4,5,6,7,8,9];
  let soma = 0; let p = 0;
  for(let i=base.length-1;i>=0;i--,p++){
    const dig = Number(base[i])||0;
    const peso = pesos[p % pesos.length];
    soma += dig * peso;
  }
  const resto = soma % 11; let dv = 11 - resto; if(dv>=10) dv = 0; return String(dv);
}

function buildNfe(note, idx){
  const EMIT_CNPJ = '11222333000181';
  const EMIT_xNome = 'Empresa Exemplo LTDA';
  const EMIT_UF = 'SP';
  const EMIT_mun = '3550308';
  const EMIT_xMun = 'Sao Paulo';
  const EMIT_IE = '123456789123';
  const EMIT_xLgr = 'Av. Exemplo';
  const EMIT_nro = '1000';
  const EMIT_xBairro = 'Centro';
  const EMIT_CEP = '01001000';
  const EMIT_fone = '1122223333';

  const dt = note.date ? new Date(note.date) : new Date();
  const year = String(dt.getFullYear());
  const month = String(dt.getMonth()+1).padStart(2,'0');
  const aamm = year.slice(2)+month;
  const isCupom = !!note.isCupom;
  const mod = isCupom ? '65' : '55';
  const serie = String(note.serie||1).padStart(3,'0');
  const nNF = String(note.documentNumber|| (idx+1)).padStart(9,'0');
  const tpEmis = String(note.tpEmis||'1');
  const cNF = String(note.cNF || genNumeric(8)).padStart(8,'0');
  const cUF = '35';
  const CNPJ = EMIT_CNPJ.replace(/\D/g,'').padStart(14,'0');

  const chaveBase = cUF + aamm + CNPJ + mod + serie + nNF + tpEmis + cNF;
  const cDV = computeDV(chaveBase);
  const chNFe = chaveBase + cDV;
  const id = 'NFe' + chNFe;
  const dh = `${year}-${month}-${String(dt.getDate()).padStart(2,'0')}T00:00:00-03:00`;
  const amountStr = (note.amount||100).toFixed(2);

  const parts = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(`<NFe xmlns="http://www.portalfiscal.inf.br/nfe">`);
  parts.push(`<infNFe Id="${escapeXmlText(id)}" versao="4.00">`);
  parts.push(`<ide>`);
  parts.push(`<cUF>${escapeXmlText(cUF)}</cUF>`);
  parts.push(`<cNF>${escapeXmlText(cNF)}</cNF>`);
  parts.push(`<natOp>VENDA</natOp>`);
  parts.push(`<mod>${escapeXmlText(mod)}</mod>`);
  parts.push(`<serie>${escapeXmlText(serie)}</serie>`);
  parts.push(`<nNF>${escapeXmlText(nNF)}</nNF>`);
  parts.push(`<dhEmi>${escapeXmlText(dh)}</dhEmi>`);
  parts.push(`<tpNF>1</tpNF>`);
  parts.push(`<idDest>1</idDest>`);
  parts.push(`<cMunFG>${escapeXmlText(EMIT_mun)}</cMunFG>`);
  parts.push(`<tpImp>${escapeXmlText(isCupom? '4' : '1')}</tpImp>`);
  parts.push(`<tpEmis>${escapeXmlText(tpEmis)}</tpEmis>`);
  parts.push(`<cDV>${escapeXmlText(cDV)}</cDV>`);
  parts.push(`<tpAmb>2</tpAmb>`);
  parts.push(`<finNFe>1</finNFe>`);
  parts.push(`<indFinal>1</indFinal>`);
  parts.push(`<indPres>${escapeXmlText(isCupom? '1':'0')}</indPres>`);
  parts.push(`<procEmi>0</procEmi>`);
  parts.push(`<verProc>caixa-facil-sample</verProc>`);
  parts.push(`</ide>`);

  parts.push(`<emit>`);
  parts.push(`<CNPJ>${escapeXmlText(CNPJ)}</CNPJ>`);
  parts.push(`<xNome>${escapeXmlText(EMIT_xNome)}</xNome>`);
  parts.push(`<enderEmit>`);
  parts.push(`<xLgr>${escapeXmlText(EMIT_xLgr)}</xLgr>`);
  parts.push(`<nro>${escapeXmlText(EMIT_nro)}</nro>`);
  parts.push(`<xBairro>${escapeXmlText(EMIT_xBairro)}</xBairro>`);
  parts.push(`<cMun>${escapeXmlText(EMIT_mun)}</cMun>`);
  parts.push(`<xMun>${escapeXmlText(EMIT_xMun)}</xMun>`);
  parts.push(`<UF>${escapeXmlText('SP')}</UF>`);
  parts.push(`<CEP>${escapeXmlText(EMIT_CEP)}</CEP>`);
  parts.push(`<cPais>1058</cPais>`);
  parts.push(`<xPais>Brasil</xPais>`);
  parts.push(`<fone>${escapeXmlText(EMIT_fone)}</fone>`);
  parts.push(`</enderEmit>`);
  parts.push(`<IE>${escapeXmlText(EMIT_IE)}</IE>`);
  parts.push(`<CRT>3</CRT>`);
  parts.push(`</emit>`);

  parts.push(`<dest>`);
  parts.push(`<CPF>${escapeXmlText(note.destCPF || '12345678909')}</CPF>`);
  parts.push(`<xNome>${escapeXmlText(note.destName || 'Consumidor Teste')}</xNome>`);
  parts.push(`<enderDest>`);
  parts.push(`<xLgr>${escapeXmlText(note.destAddr || 'Rua Teste')}</xLgr>`);
  parts.push(`<nro>0</nro>`);
  parts.push(`<xBairro>Centro</xBairro>`);
  parts.push(`<cMun>${escapeXmlText(EMIT_mun)}</cMun>`);
  parts.push(`<xMun>${escapeXmlText(EMIT_xMun)}</xMun>`);
  parts.push(`<UF>SP</UF>`);
  parts.push(`<CEP>01001000</CEP>`);
  parts.push(`<cPais>1058</cPais>`);
  parts.push(`<xPais>Brasil</xPais>`);
  parts.push(`</enderDest>`);
  parts.push(`<indIEDest>9</indIEDest>`);
  parts.push(`</dest>`);

  parts.push(`<det nItem="1">`);
  parts.push(`<prod>`);
  parts.push(`<cProd>0001</cProd>`);
  parts.push(`<cEAN></cEAN>`);
  parts.push(`<xProd>${escapeXmlText(note.itemName || 'Produto Teste')}</xProd>`);
  parts.push(`<NCM>${escapeXmlText((note.ncm||'01012100').padStart(8,'0'))}</NCM>`);
  parts.push(`<CEST>${escapeXmlText((note.cest||'1234567').padStart(7,'0'))}</CEST>`);
  parts.push(`<CFOP>${escapeXmlText(note.cfop||'5102')}</CFOP>`);
  parts.push(`<uCom>un</uCom>`);
  parts.push(`<qCom>1.0000</qCom>`);
  parts.push(`<vUnCom>${escapeXmlText(amountStr)}</vUnCom>`);
  parts.push(`<vProd>${escapeXmlText(amountStr)}</vProd>`);
  parts.push(`<uTrib>un</uTrib>`);
  parts.push(`<qTrib>1.0000</qTrib>`);
  parts.push(`<vUnTrib>${escapeXmlText(amountStr)}</vUnTrib>`);
  parts.push(`<indTot>1</indTot>`);
  parts.push(`</prod>`);
  parts.push(`<imposto>`);
  parts.push(`<vTotTrib>0.00</vTotTrib>`);
  parts.push(`<ICMS><ICMS00><orig>0</orig><CST>00</CST><vBC>0.00</vBC><pICMS>0.00</pICMS><vICMS>0.00</vICMS></ICMS00></ICMS>`);
  parts.push(`<PIS><PISAliq><CST>01</CST><vBC>0.00</vBC><pPIS>0.00</pPIS><vPIS>0.00</vPIS></PISAliq></PIS>`);
  parts.push(`<COFINS><COFINSAliq><CST>01</CST><vBC>0.00</vBC><pCOFINS>0.00</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSAliq></COFINS>`);
  parts.push(`</imposto>`);
  parts.push(`</det>`);

  parts.push(`<total>`);
  parts.push(`<ICMSTot>`);
  parts.push(`<vBC>0.00</vBC>`);
  parts.push(`<vICMS>0.00</vICMS>`);
  parts.push(`<vICMSDeson>0.00</vICMSDeson>`);
  parts.push(`<vFCP>0.00</vFCP>`);
  parts.push(`<vBCST>0.00</vBCST>`);
  parts.push(`<vST>0.00</vST>`);
  parts.push(`<vFCPST>0.00</vFCPST>`);
  parts.push(`<vFCPSTRet>0.00</vFCPSTRet>`);
  parts.push(`<vProd>${escapeXmlText(amountStr)}</vProd>`);
  parts.push(`<vFrete>0.00</vFrete>`);
  parts.push(`<vSeg>0.00</vSeg>`);
  parts.push(`<vDesc>0.00</vDesc>`);
  parts.push(`<vII>0.00</vII>`);
  parts.push(`<vIPI>0.00</vIPI>`);
  parts.push(`<vIPIDevol>0.00</vIPIDevol>`);
  parts.push(`<vPIS>0.00</vPIS>`);
  parts.push(`<vCOFINS>0.00</vCOFINS>`);
  parts.push(`<vOutro>0.00</vOutro>`);
  parts.push(`<vNF>${escapeXmlText(amountStr)}</vNF>`);
  parts.push(`<vTotTrib>0.00</vTotTrib>`);
  parts.push(`</ICMSTot>`);
  parts.push(`</total>`);

  parts.push(`<transp><modFrete>0</modFrete></transp>`);
  parts.push(`<pag><detPag><tPag>01</tPag><vPag>${escapeXmlText(amountStr)}</vPag></detPag></pag>`);
  parts.push(`<infAdic><infCpl>${escapeXmlText(note.note||'')}</infCpl></infAdic>`);
  parts.push(`<infRespTec><CNPJ>${escapeXmlText(CNPJ)}</CNPJ><xContato>Suporte</xContato><email>suporte@example.com</email><fone>${escapeXmlText(EMIT_fone)}</fone></infRespTec>`);

  parts.push(`</infNFe>`);
  parts.push(`</NFe>`);

  return parts.join('\n');
}

const sample = {
  documentNumber: '123',
  date: new Date().toISOString(),
  amount: 100.00,
  description: 'Compra Teste',
  supplier: 'Fornecedor Exemplo'
};

const xml = buildNfe(sample,0);
fs.writeFileSync('layout/sistema-caixa-facil/sample_nfe.xml', xml, { encoding: 'utf8' });
console.log('Wrote layout/sistema-caixa-facil/sample_nfe.xml');
