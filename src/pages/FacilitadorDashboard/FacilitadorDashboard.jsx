import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import '../../index.css';
import '../../assets/css/RoomConfig.css';
import './FacilitadorDashboard.css';
import GraficoDemandaEmpresas from '../../components/GraficoDemandaEmpresas';

const FacilitadorDashboard = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [configRoom, setConfigRoom] = useState(null);
  const [resultStatus, setResultStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [roundAtual, setRoundAtual] = useState(1);
  const [resultado, setResultado] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [historicoDemanda, setHistoricoDemanda] = useState([]);
  const facilitadorToken = localStorage.getItem('facilitadorToken');

  const hasResults = resultado.length > 0;
  const totalRounds = configRoom?.totalRounds || configRoom?.demandaEstqRounds?.length || '---';

  const carregarResultado = useCallback(async () => {
    if (!code || !facilitadorToken) return;

    setResultStatus((status) => (status === 'ready' ? status : 'loading'));
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/rooms/${code}/resultado/${roundAtual}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-facilitator-token': facilitadorToken,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Nao foi possivel validar o acesso do facilitador.');
        }

        setResultado([]);
        setHistoricoDemanda([]);
        setResultStatus('waiting');
        return;
      }

      const data = await response.json();
      setResultado(Array.isArray(data) ? data : []);
      setResultStatus('ready');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Nao foi possivel carregar os dados da sala.');
      setResultStatus('error');
    }
  }, [code, facilitadorToken, roundAtual]);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL);

    socket.emit('join_room', code);
    socket.on('connect', () => console.log('Socket conectado:', socket.id));
    socket.on('disconnect', () => console.log('Socket desconectado'));
    socket.on('companies_updated', (updatedCompanies) => {
      setCompanies(Array.isArray(updatedCompanies) ? updatedCompanies : []);
    });
    socket.on('all_companies_confirmed', () => {
      carregarResultado();
    });

    return () => {
      socket.off('companies_updated');
      socket.off('all_companies_confirmed');
      socket.off('connect');
      socket.off('disconnect');
      socket.disconnect();
    };
  }, [code, carregarResultado]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/companies/${code}`)
      .then(res => (res.ok ? res.json() : []))
      .then(data => setCompanies(Array.isArray(data) ? data : []))
      .catch(err => console.error('Erro ao buscar empresas:', err));
  }, [code]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/rooms/${code}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Erro ao buscar dados da sala');
        }
        return response.json();
      })
      .then((data) => {
        setConfigRoom(data);
      })
      .catch((err) => {
        console.error(err);
        setError('Nao foi possivel carregar os dados da sala. Por favor, tente novamente mais tarde.');
      });
  }, [code]);

  useEffect(() => {
    carregarResultado();
  }, [carregarResultado]);

  useEffect(() => {
    if (resultStatus !== 'waiting') return undefined;

    const intervalId = setInterval(() => {
      carregarResultado();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [carregarResultado, resultStatus]);

  useEffect(() => {
    const carregarHistorico = async () => {
      const novoHistorico = [];

      for (let r = 1; r <= roundAtual; r++) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/rooms/${code}/resultado/${r}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-facilitator-token': facilitadorToken,
            },
          });

          if (response.ok) {
            const data = await response.json();
            const pontoRodada = { rodada: `Rodada ${r}` };

            data.forEach(empresa => {
              const nome = empresa.company?.name || empresa.name || `Empresa ${empresa.id}`;
              const valorDemanda = (empresa.percentualDemanda || 0) * 100;
              pontoRodada[nome] = parseFloat(valorDemanda.toFixed(1));
            });

            novoHistorico.push(pontoRodada);
          }
        } catch (err) {
          console.error(`Erro ao buscar historico da rodada ${r}:`, err);
        }
      }

      setHistoricoDemanda(novoHistorico);
    };

    if (code && facilitadorToken && hasResults) {
      carregarHistorico();
    }
  }, [code, facilitadorToken, hasResults, roundAtual]);

  const fmt = (v) => {
    if (v === undefined || v === null || isNaN(v)) return 'R$ 0,00';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const fmtPercent = (v) => {
    if (v === undefined || v === null || isNaN(v)) return '0%';
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + '%';
  };

  const getCompanyName = (empresa, index) => empresa.company?.name || empresa.name || `Empresa ${index + 1}`;
  const getManagerName = (empresa) => empresa.company?.managerName || empresa.managerName || '---';
  const getInitials = (name = '') => name
    .split(' ')
    .filter(Boolean)
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '--';

  const getTotalVendido = (empresa) => (
    (empresa.qtdVendidaPereciveis || 0) +
    (empresa.qtdVendidaMercearia || 0) +
    (empresa.qtdVendidaHipel || 0) +
    (empresa.qtdVendidaEletro || 0)
  );

  const avancarRodada = () => {
    if (totalRounds !== '---' && roundAtual >= totalRounds) return;
    setRoundAtual(prev => prev + 1);
  };

  return (
    <div className="config-container">
      <aside className="config-sidebar">
        <div className="sidebar-top">
          <h1 className="config-title">Dashboard<br />do Facilitador</h1>
          <span className="config-title-accent" />
          <p className="config-subtitle">
            Acompanhe a configuracao das empresas e os resultados em tempo real.
          </p>
        </div>

        <div className="dash-info-card">
          <span className="dash-info-label">Sala</span>
          <strong className="dash-info-value">{code}</strong>
        </div>

        <div className="dash-info-card">
          <span className="dash-info-label">Empresas Conectadas</span>
          <strong className="dash-info-value">{companies.length || resultado.length}</strong>
        </div>

        <div className="dash-info-card">
          <span className="dash-info-label">Rodada Atual</span>
          <strong className="dash-info-value">{roundAtual} / {totalRounds}</strong>
        </div>
      </aside>

      <div className="config-main">
        <div className="config-content">
          {!hasResults && (
            <section className="config-section facilitator-waiting-panel">
              <div>
                <span className="facilitator-status-kicker">
                  {resultStatus === 'loading' ? 'Sincronizando' : 'Empresas em configuracao'}
                </span>
                <h3 className="section-subtitle">O painel do facilitador continua ativo</h3>
                <p className="facilitator-waiting-text">
                  Os resultados aparecem automaticamente quando as empresas confirmarem suas estrategias.
                </p>
                {error && <p className="facilitator-error-text">{error}</p>}
              </div>

              <div className="facilitator-company-progress">
                <strong>{companies.length}</strong>
                <span>empresa{companies.length === 1 ? '' : 's'} na sala</span>
              </div>

              <div className="facilitator-company-list">
                {companies.length === 0 ? (
                  <div className="facilitator-company-empty">Aguardando empresas entrarem na sala...</div>
                ) : (
                  companies.map(company => (
                    <div className="facilitator-company-pill" key={company.id || company.name}>
                      <span>{getInitials(company.name)}</span>
                      <div>
                        <strong>{company.name}</strong>
                        <small>{company.managerName || 'Gerente nao informado'}</small>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                className="btn-start facilitator-quiz-button"
                onClick={() => navigate(`/facilitador-quiz/${code}`)}
                disabled={companies.length === 0}
              >
                Ver acertos das empresas
              </button>
            </section>
          )}

          <section className="config-section">
            <h3 className="section-subtitle">Resultados das Empresas</h3>
            <GraficoDemandaEmpresas historicoDados={historicoDemanda} />
            <div className="dash-table">
              <div className="dash-table-header">
                <span>Empresa</span>
                <span className="dash-center">Preco Medio<br />da Cesta</span>
                <span className="dash-center">Disponibilidade</span>
                <span className="dash-center">CSAT</span>
                <span className="dash-center">% Part. Demanda<br />de Vendas</span>
              </div>
              {!hasResults && (
                <div className="dash-table-empty">Aguardando configuracao das empresas.</div>
              )}
              {resultado.map((empresa, index) => (
                <div className="dash-table-row" key={empresa.id || empresa.name || index}>
                  <span className="dash-empresa-name">{getCompanyName(empresa, index)}</span>
                  <span className="dash-center">{fmt(empresa.precoMedioCesta)}</span>
                  <span className="dash-center">{fmtPercent(empresa.disponibilidade)}</span>
                  <span className="dash-center">{fmtPercent(empresa.csat)}</span>
                  <span className="dash-center">{fmtPercent((empresa.percentualDemanda || 0) * 100)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="config-section">
            <h3 className="section-subtitle">Ranking</h3>
            <div className="dash-table">
              <div className="dash-table-header dash-ranking-header">
                <span>Colocacao</span>
                <span>Empresa</span>
                <span>Gerente</span>
                <span className="dash-center">Total de Vendas</span>
              </div>
              {!hasResults && (
                <div className="dash-table-empty">Ranking sera exibido apos a rodada.</div>
              )}
              {resultado.map((empresa, index) => (
                <div className={`dash-table-row dash-ranking-row ${index === 0 ? 'dash-row-first' : ''}`} key={empresa.id || empresa.name || index}>
                  <span className="dash-position">{index + 1}°</span>
                  <span className="dash-empresa-name">{getCompanyName(empresa, index)}</span>
                  <span>{getManagerName(empresa)}</span>
                  <span className="dash-center dash-total-score">
                    <strong>{fmt(empresa.receitaTotal)}</strong>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="config-section">
            <h3 className="section-subtitle">Demanda de vendas da rodada</h3>
            <div className="dash-table" style={{ marginBottom: 20 }}>
              <div className="dash-table-header dash-demanda-header">
                <span>Rodada</span>
                <span className="dash-center">Pereciveis</span>
                <span className="dash-center">Mercearia</span>
                <span className="dash-center">Eletro</span>
                <span className="dash-center">Hipel</span>
                <span className="dash-center">Total</span>
              </div>
              {configRoom ? (
                <div className="dash-table-row dash-demanda-row">
                  <span className="dash-empresa-name">Rodada {roundAtual} - {configRoom.demandaEstqRounds?.[roundAtual - 1] || 0}%</span>
                  <span className="dash-center">
                    {((configRoom.estoqueDisponivelPereciveis || 0) * ((configRoom.demandaEstqRounds?.[roundAtual - 1] || 0) / 100)).toLocaleString('pt-BR')}
                  </span>
                  <span className="dash-center">
                    {((configRoom.estoqueDisponivelMercearia || 0) * ((configRoom.demandaEstqRounds?.[roundAtual - 1] || 0) / 100)).toLocaleString('pt-BR')}
                  </span>
                  <span className="dash-center">
                    {((configRoom.estoqueDisponivelEletro || 0) * ((configRoom.demandaEstqRounds?.[roundAtual - 1] || 0) / 100)).toLocaleString('pt-BR')}
                  </span>
                  <span className="dash-center">
                    {((configRoom.estoqueDisponivelHipel || 0) * ((configRoom.demandaEstqRounds?.[roundAtual - 1] || 0) / 100)).toLocaleString('pt-BR')}
                  </span>
                  <span className="dash-center">
                    <strong>
                      {(
                        ((configRoom.estoqueDisponivelPereciveis || 0) * ((configRoom.demandaEstqRounds?.[roundAtual - 1] || 0) / 100)) +
                        ((configRoom.estoqueDisponivelMercearia || 0) * ((configRoom.demandaEstqRounds?.[roundAtual - 1] || 0) / 100)) +
                        ((configRoom.estoqueDisponivelEletro || 0) * ((configRoom.demandaEstqRounds?.[roundAtual - 1] || 0) / 100)) +
                        ((configRoom.estoqueDisponivelHipel || 0) * ((configRoom.demandaEstqRounds?.[roundAtual - 1] || 0) / 100))
                      ).toLocaleString('pt-BR')}
                    </strong>
                  </span>
                </div>
              ) : (
                <div className="dash-table-empty">Carregando demanda...</div>
              )}
            </div>
          </section>

          <section className="config-section">
            <h3 className="section-subtitle">Vendas por Empresa</h3>
            <div className="dash-table">
              <div className="dash-table-header dash-vendas-header">
                <span>Empresa</span>
                <span className="dash-center">Pereciveis</span>
                <span className="dash-center">Mercearia</span>
                <span className="dash-center">Eletro</span>
                <span className="dash-center">Hipel</span>
                <span className="dash-center">Total estoque vendido</span>
              </div>
              {!hasResults && (
                <div className="dash-table-empty">Aguardando vendas da rodada.</div>
              )}
              {resultado.map((empresa, index) => (
                <div className="dash-table-row dash-vendas-row" key={empresa.id || empresa.company?.name || index}>
                  <span className="dash-empresa-name">{getCompanyName(empresa, index)}</span>
                  <span className="dash-center">{(empresa.qtdVendidaPereciveis || 0).toLocaleString('pt-BR')}</span>
                  <span className="dash-center">{(empresa.qtdVendidaMercearia || 0).toLocaleString('pt-BR')}</span>
                  <span className="dash-center">{(empresa.qtdVendidaEletro || 0).toLocaleString('pt-BR')}</span>
                  <span className="dash-center">{(empresa.qtdVendidaHipel || 0).toLocaleString('pt-BR')}</span>
                  <span className="dash-center dash-total-score">
                    <strong>{getTotalVendido(empresa).toLocaleString('pt-BR')}</strong>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="config-section">
            <h3 className="section-subtitle">Receita detalhada por empresa</h3>
            <div className="dash-table">
              <div className="dash-table-header dash-vendas-header">
                <span>Empresa</span>
                <span className="dash-center">Pereciveis</span>
                <span className="dash-center">Mercearia</span>
                <span className="dash-center">Eletro</span>
                <span className="dash-center">Hipel</span>
                <span className="dash-center">Total estoque vendido</span>
              </div>
              {!hasResults && (
                <div className="dash-table-empty">Aguardando receita da rodada.</div>
              )}
              {resultado.map((empresa, index) => (
                <div className="dash-table-row dash-vendas-row" key={empresa.id || empresa.company?.name || index}>
                  <span className="dash-empresa-name">{getCompanyName(empresa, index)}</span>
                  <span className="dash-center">{fmt(empresa.receitaPereciveis || 0)}</span>
                  <span className="dash-center">{fmt(empresa.receitaMercearia || 0)}</span>
                  <span className="dash-center">{fmt(empresa.receitaEletro || 0)}</span>
                  <span className="dash-center">{fmt(empresa.receitaHipel || 0)}</span>
                  <span className="dash-center dash-total-score">
                    <strong>{fmt(empresa.receitaTotal)}</strong>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <div className="waiting-actions">
            {facilitadorToken && (
              <button
                className="btn-start"
                onClick={avancarRodada}
                disabled={!hasResults || (totalRounds !== '---' && roundAtual >= totalRounds)}
              >
                Proxima rodada
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacilitadorDashboard;
