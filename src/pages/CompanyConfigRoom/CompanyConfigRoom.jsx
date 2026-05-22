import Modal from '../../components/Modal';
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getCompanySettings, saveCompanySettings } from '../../services/CompanyService';
import "../../index.css";
import '../../assets/css/RoomConfig.css';
import './CompanyConfigRoom.css';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';

const CARGOS = ['Serviços', 'Abastecimento', 'Comercial', 'Operacional', 'Gerente'];

const CAPEX_ITEMS = [
  { key: 'capexSegurancaValor', field: 'capexSegurancaValor', label: 'Segurança', risk: 'Furtos e perdas sem sistema de segurança' },
  { key: 'balanca', field: 'capexBalancaValor', label: 'Balança', risk: 'Impossibilidade de pesar produtos' },
  { key: 'freezer', field: 'capexFreezerValor', label: 'Freezer', risk: 'Perda de perecíveis por falta de refrigeração' },
  { key: 'redes', field: 'capexRedesValor', label: 'Redes', risk: 'Falha de conectividade e sistemas offline' },
  { key: 'site', field: 'capexSiteValor', label: 'Site', risk: 'Sem presença digital e vendas online' },
  { key: 'selfCheckout', field: 'capexSelfCheckoutValor', label: 'Self Checkout', risk: 'Filas maiores e custo operacional elevado' },
  { key: 'melhoriaContinua', field: 'capexMelhoriaContinuaValor', label: 'Melhoria Contínua', risk: 'Processos ineficientes sem otimização' },
];

const CompanyConfigRoom = () => {
  const code = localStorage.getItem('codeRoom');
  const navigate = useNavigate();
  const [configRoom, setConfigRoom] = useState({});
  const [warning, setWarning] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [socket, setSocket] = useState(null);
  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_API_URL);
    setSocket(newSocket);

    newSocket.emit('join_room', code);

    newSocket.on('all_companies_confirmed', (data) => {
      console.log('Todas as empresas confirmaram!', data);
      setTimeout(() => {
        navigate(`/ranking`);}, 2000); 
    });

    return () => {
      newSocket.disconnect();
    };
  }, [navigate]);  // ✅ NOVO

  const { companyId } = useParams();

  const [params, setParams] = useState({
    saldoInicial: 0, juros: 12, custoPorOperador: 3000,
    custoUntPereciveis: 0, custoUntMercearia: 0, custoUntEletro: 0, custoUntHipel: 0,
    capexItems: [],
  });

  const [cargos, setCargos] = useState({
    servicos: '', abastecimento: '', comercial: '', operacional: '', gerente: '',
  });

  const [capexSelected, setCapexSelected] = useState([]);

  const [formData, setFormData] = useState({
    margemPereciveis: 15,
    margemMercearia: 10,
    margemEletro: 25,
    margemHipel: 18,
    estoquePereciveis: 0,
    estoqueMercearia: 0,
    estoqueEletro: 0,
    estoqueHipel: 0,
    estoqueDisponivelPereciveis: 1000,
    estoqueDisponivelMercearia: 1000,
    estoqueDisponivelEletro: 1000,
    estoqueDisponivelHipel: 1000,
    disponibilidadePereciveis: 100,
    disponibilidadeMercearia: 100,
    disponibilidadeEletro: 100,
    disponibilidadeHipel: 100,
    operadoresCaixa: 0,
    operadoresServico: 0,
    capexSegurancaValor: false,
    capexBalancaValor: false,
    capexFreezerValor: false,
    capexRedesValor: false,
    capexSiteValor: false,
    capexSelfCheckoutValor: false,
    capexMelhoriaContinuaValor: false,
  });
  const handleChange = (e) => {
  const { name, value, type, checked } = e.target;
  if (name.startsWith('estoque')) {
    const catKey = name.replace('estoque', '');
    const disponivel = formData[`estoqueDisponivel${catKey}`];
    const numValue = Number(value) || 0;
    
    // Não permite comprar mais que o disponível
    if (numValue > disponivel) {
      console.warn(`⚠️ Quantidade não pode exceder o disponível (${disponivel} un.)`);
      return; // Não atualiza o estado
    }
  }
  setFormData(prev => ({
    ...prev,
    [name]: type === 'checkbox' ? checked : (Number(value) || 0)
  }));
};

const toggleCapex = (key) => {
  setFormData(prev => ({
    ...prev,
    [key]: !prev[key]
  }));
};

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  //pegar dados da sala
  useEffect(() => {
    try{
      fetch (`${import.meta.env.VITE_API_URL}/rooms/${code}`, {
        method: 'GET',
      })
      .then(res => res.json())
      .then(data => {
        setConfigRoom(data);
        console.log('Configurações da sala:', data);
      });
    } catch (error) {
      console.error('Erro ao buscar configurações da sala:', error);
    }
  }, [code]);
  useEffect(() => {
    if (Object.keys(configRoom).length > 0) {
      console.log('✅ configRoom atualizado no estado:', configRoom);
    }
  }, [configRoom]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getCompanySettings(companyId);
        setParams(data);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Erro ao carregar dados da empresa');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [companyId]);

  // Cálculos dinâmicos
  const totalCapex = CAPEX_ITEMS.reduce((sum, item) => {
  // Se o item foi selecionado (true), adiciona o custo
  const isSelected = formData[item.field];
  const cost = isSelected ? (configRoom[item.field] || 0) : 0;
  return sum + cost;
}, 0);
useEffect(() => {
  console.log('form:', formData);
}, [formData]);

  const custoEstoque =
    formData.estoquePereciveis * configRoom.custoUntPereciveis +
    formData.estoqueMercearia * configRoom.custoUntMercearia +
    formData.estoqueEletro * configRoom.custoUntEletro +
    formData.estoqueHipel * configRoom.custoUntHipel;

  const custoPessoal = (formData.operadoresCaixa + formData.operadoresServico) * params.custoPorOperador;
  const totalGastos = totalCapex + custoEstoque + custoPessoal;
  const saldoRestante = params.saldoInicial - totalGastos;
  const excedente = Math.max(0, -saldoRestante);
  const jurosPrevistos = excedente * (params.juros / 100);

  const precoCesta =
    configRoom.custoUntPereciveis * (1 + formData.margemPereciveis / 100) +
    configRoom.custoUntMercearia * (1 + formData.margemMercearia / 100) +
    configRoom.custoUntEletro * (1 + formData.margemEletro / 100) +
    configRoom.custoUntHipel * (1 + formData.margemHipel / 100);

  // Handlers

  const handleCargoChange = (e) => {
    const { name, value } = e.target;
    setCargos(prev => ({ ...prev, [name]: value }));
  };

 
  useEffect(() => {
    console.log("capex selecionado:", capexSelected);
  }, [capexSelected]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = formData;
      const result = await saveCompanySettings(companyId, payload);
      let msg = result.message || 'Estratégia confirmada com sucesso!';
      if (result.jurosAplicado > 0) {
        msg += `\n⚠️ Juros aplicados: R$ ${result.jurosAplicado.toLocaleString('pt-BR')}`;
      }
      setConfirmMessage(msg);
      setShowConfirmModal(true);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao salvar configurações');
      setWarning(true);
      setTimeout(() => setWarning(false), 3000);
    } finally {
      setSaving(false);
    }
  };

// Função para formatar percentual com até 2 casas decimais

  const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtPercent = (value) => {
  return value.toLocaleString('pt-BR', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 2 
  });
};
  return (
    <div className="config-container">
      {/* Sidebar */}
      <aside className="config-sidebar company-config-sidebar">
        <div className="sidebar-top">
          <h1 className="config-title">Painel de Estratégia</h1>
          <span className="config-title-accent" />
          <p className="config-subtitle">
            Defina cargos, investimentos, estoque, preços e pessoal para esta rodada.
          </p>
        </div>

        <div className="sidebar-metrics">
          <div className={`balance-card ${saldoRestante < 0 ? 'insufficient-funds' : ''}`}>
            <span className="balance-label">Saldo Disponível</span>
            <strong className="balance-value">{fmt(saldoRestante)}</strong>
            {/* Detalhamento de Gastos 
            <div className="gasto-detalhamento">
              <div className="gasto-item">
                <span className="gasto-label">CAPEX</span>
                <span className="gasto-valor">{fmt(totalCapex)}</span>
              </div>
              <div className="gasto-item">
                <span className="gasto-label">Estoque</span>
                <span className="gasto-valor">{fmt(custoEstoque)}</span>
              </div>
              <div className="gasto-item">
                <span className="gasto-label">Pessoal</span>
                <span className="gasto-valor">{fmt(custoPessoal)}</span>
              </div>
              <div className="gasto-item gasto-total">
                <span className="gasto-label">Total Gastos</span>
                <span className="gasto-valor">{fmt(totalGastos)}</span>
              </div>
            </div>*/}
            <span className="balance-hint">Gasto: {fmt(totalGastos)}</span>
            {excedente > 0 && (
              <div className="juros-alert">
                ⚠️ Excedente: {fmt(excedente)} → Juros de {params.juros}%: {fmt(jurosPrevistos)}
              </div>
            )}
          </div>

          <div className="cesta-resumo">
            <span className="balance-label">Preço Final da Cesta</span>
            <strong className="balance-value">{fmt(precoCesta)}</strong>
          </div>
        </div>
      </aside>

      {/* Painel principal */}
      <div className="config-main">
        

        {loading && <div className="status-message loading">Carregando dados...</div>}
        {error && <div className="status-message error">Erro: {error}</div>}

        <div className="config-content">
          {/* SEÇÃO 1: Gestão de Pessoas */}
          <section className="config-section">
            <h3 className="section-subtitle">Gestão de Pessoas — Cargos</h3>
            <div className="input-grid">
              {CARGOS.map(cargo => (
                <div className="input-group" key={cargo}>
                  <label htmlFor={`cargo-${cargo}`}>{cargo}</label>
                  <input
                    id={`cargo-${cargo}`}
                    name={cargo.toLowerCase()}
                    type="text"
                    placeholder="Nome do integrante"
                    value={cargos[cargo.toLowerCase()] || ''}
                    onChange={handleCargoChange}
                  />
                </div>
              ))}
            </div>

            <h3 className="section-subtitle" style={{ marginTop: 28 }}>Dimensionamento de Pessoal</h3>
            <p className="section-hint">Custo: {fmt(params.custoPorOperador)} por operador</p>
            <div className="input-grid">
              <div className="input-group">
                <label htmlFor="operadoresCaixa">Operadores de Caixa</label>
                <input id="operadoresCaixa" name="operadoresCaixa" type="number" min="0"
                  value={formData.operadoresCaixa} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label htmlFor="operadoresServico">Operadores de Serviço</label>
                <input id="operadoresServico" name="operadoresServico" type="number" min="0"
                  value={formData.operadoresServico} onChange={handleChange} />
              </div>
              <div className="input-group readonly-group">
                <label>Custo Total Pessoal</label>
                <span className="computed-value">{fmt(custoPessoal)}</span>
              </div>
            </div>
          </section>

          {/* SEÇÃO 2: CAPEX */}
                    {/* SEÇÃO 2: CAPEX */}
          <section className="config-section">
            <h3 className="section-subtitle">Investimentos (CAPEX)</h3>
            <p className="section-hint">Selecione os itens de infraestrutura. Itens não comprados podem gerar incidentes.</p>
            <div className="capex-grid">
              
              {/* Segurança */}
              <div
                className={`capex-card ${formData.capexSegurancaValor ? 'selected' : ''}`}
                onClick={() => toggleCapex('capexSegurancaValor')}
              >
                <div className="capex-card-header">
                  <span className="capex-check">{formData.capexSegurancaValor ? '✓' : ''}</span>
                  <strong className="capex-label">Segurança</strong>
                  <span className="capex-cost">{fmt(configRoom.capexSegurancaValor || 0)}</span>
                </div>
                <p className="capex-risk">⚠ Risco: Furtos e perdas sem sistema de segurança</p>
              </div>

              {/* Balança */}
              <div
                className={`capex-card ${formData.capexBalancaValor ? 'selected' : ''}`}
                onClick={() => toggleCapex('capexBalancaValor')}
              >
                <div className="capex-card-header">
                  <span className="capex-check">{formData.capexBalancaValor ? '✓' : ''}</span>
                  <strong className="capex-label">Balança</strong>
                  <span className="capex-cost">{fmt(configRoom.capexBalancaValor || 0)}</span>
                </div>
                <p className="capex-risk">⚠ Risco: Impossibilidade de pesar produtos</p>
              </div>

              {/* Freezer */}
              <div
                className={`capex-card ${formData.capexFreezerValor ? 'selected' : ''}`}
                onClick={() => toggleCapex('capexFreezerValor')}
              >
                <div className="capex-card-header">
                  <span className="capex-check">{formData.capexFreezerValor ? '✓' : ''}</span>
                  <strong className="capex-label">Freezer</strong>
                  <span className="capex-cost">{fmt(configRoom.capexFreezerValor || 0)}</span>
                </div>
                <p className="capex-risk">⚠ Risco: Perda de perecíveis por falta de refrigeração</p>
              </div>

              {/* Redes */}
              <div
                className={`capex-card ${formData.capexRedesValor ? 'selected' : ''}`}
                onClick={() => toggleCapex('capexRedesValor')}
              >
                <div className="capex-card-header">
                  <span className="capex-check">{formData.capexRedesValor ? '✓' : ''}</span>
                  <strong className="capex-label">Redes</strong>
                  <span className="capex-cost">{fmt(configRoom.capexRedesValor || 0)}</span>
                </div>
                <p className="capex-risk">⚠ Risco: Falha de conectividade e sistemas offline</p>
              </div>

              {/* Site */}
              <div
                className={`capex-card ${formData.capexSiteValor ? 'selected' : ''}`}
                onClick={() => toggleCapex('capexSiteValor')}
              >
                <div className="capex-card-header">
                  <span className="capex-check">{formData.capexSiteValor ? '✓' : ''}</span>
                  <strong className="capex-label">Site</strong>
                  <span className="capex-cost">{fmt(configRoom.capexSiteValor || 0)}</span>
                </div>
                <p className="capex-risk">⚠ Risco: Sem presença digital e vendas online</p>
              </div>

              {/* Self Checkout */}
              <div
                className={`capex-card ${formData.capexSelfCheckoutValor ? 'selected' : ''}`}
                onClick={() => toggleCapex('capexSelfCheckoutValor')}
              >
                <div className="capex-card-header">
                  <span className="capex-check">{formData.capexSelfCheckoutValor ? '✓' : ''}</span>
                  <strong className="capex-label">Self Checkout</strong>
                  <span className="capex-cost">{fmt(configRoom.capexSelfCheckoutValor || 0)}</span>
                </div>
                <p className="capex-risk">⚠ Risco: Filas maiores e custo operacional elevado</p>
              </div>

              {/* Melhoria Contínua */}
              <div
                className={`capex-card ${formData.capexMelhoriaContinuaValor ? 'selected' : ''}`}
                onClick={() => toggleCapex('capexMelhoriaContinuaValor')}
              >
                <div className="capex-card-header">
                  <span className="capex-check">{formData.capexMelhoriaContinuaValor ? '✓' : ''}</span>
                  <strong className="capex-label">Melhoria Contínua</strong>
                  <span className="capex-cost">{fmt(configRoom.capexMelhoriaContinuaValor || 0)}</span>
                </div>
                <p className="capex-risk">⚠ Risco: Processos ineficientes sem otimização</p>
              </div>

            </div>
            <div className="capex-total">
              Total CAPEX: <strong>{fmt(totalCapex)}</strong>
            </div>
          </section>
          {/* SEÇÃO 3: Estoque + Margens */}
          <section className="config-section">
            <h3 className="section-subtitle">Abastecimento e Comercial</h3>
            <div className="stock-table">
              <div className="stock-header">
                <span>Categoria</span>
                <span className="stock-center">Custo <br /> Unitário</span>
                <span className="stock-center">Disponível</span>
                <span className="stock-center">Qtd. <br /> Comprar</span>
                <span className="stock-center">Disponibilidade <br /> (%)</span>
                <span className="stock-center">Custo <br /> Total</span>
                <span className="stock-center">Imposto <br /> (%)</span>
                <span className="stock-center">Margem <br /> (%)</span>
                <span className="stock-center">Preço <br /> Venda</span>
                <span className="stock-center">Disponibilidade <br /> (%)</span>
              </div>
              {[
                { key: 'Pereciveis', label: 'Perecíveis', custo: configRoom.custoUntPereciveis || 0, imposto: configRoom.impostoPereciveis || 0 },
                { key: 'Mercearia', label: 'Mercearia', custo: configRoom.custoUntMercearia || 0, imposto: configRoom.impostoMercearia || 0 },
                { key: 'Eletro', label: 'Eletro', custo: configRoom.custoUntEletro || 0, imposto: configRoom.impostoEletro || 0 },
                { key: 'Hipel', label: 'Hipel', custo: configRoom.custoUntHipel || 0, imposto: configRoom.impostoHipel || 0 },
              ].map(cat => {
                const qtd = formData[`estoque${cat.key}`];
                const margem = formData[`margem${cat.key}`];
                const disponivel = formData[`estoqueDisponivel${cat.key}`];
                const disponibilidade = disponivel > 0 ? (qtd / disponivel) * 100 : 0;
                const custoTotal = qtd * cat.custo;
                const precoVenda = cat.custo * (1 + margem / 100);
                return (
                  <div className="stock-row" key={cat.key}>
                    <span className="stock-cat">{cat.label}</span>
                    <span className="stock-center">{fmt(cat.custo)}</span>
                    <span className="stock-center">{disponivel} un.</span>
                    <input 
                      name={`estoque${cat.key}`} 
                      type="text" 
                      min="0"
                      max={disponivel}
                      value={qtd} 
                      onChange={handleChange} 
                      className="stock-input"
                    />
                    <span className="stock-center stock-disponibilidade">
                      {fmtPercent(disponibilidade)}%
                    </span>
                    
                    <span className="stock-center">{fmt(custoTotal)}</span>
                    <span className="stock-center">{cat.imposto}%</span>
                    <input 
                      name={`margem${cat.key}`} 
                      type="text" 
                      min="0"
                      value={margem} 
                      onChange={handleChange} 
                      className="stock-input"
                    />
                    <span className="stock-price stock-center">{fmt(precoVenda)}</span>
                    
                    
                  </div>
                );
              })}
              <div className="stock-row stock-summary">
                <span className="stock-cat">Total</span>
                <span></span>
                <span></span>
                <span></span>
                <span className="stock-center"><strong>{fmt(custoEstoque)}</strong></span>
                <span></span>
                <span></span>
                <span className="stock-price stock-center"><strong>{fmt(precoCesta)}</strong></span>
                <span></span>
              </div>
            </div>
          </section>

          <button className="btn-confirm" onClick={handleSave} disabled={saving}>
            {saving ? 'SALVANDO...' : 'CONFIRMAR ESTRATÉGIA'}
          </button>
        </div>
      </div>
      <Modal
        isOpen={showConfirmModal}
        type="confirm"
        title="Estratégia Confirmada"
        message={confirmMessage}
      />
      <Modal
        isOpen={warning}
        type="warning"
        title="Erro ao salvar Dados"
        message="Erro ao salvar os dados"
      />
    </div>
  );
};

export default CompanyConfigRoom;
