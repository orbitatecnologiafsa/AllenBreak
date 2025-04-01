/**
 * Controlador principal para gerenciamento de impressões digitais
 * e integração com o Firebase
 */
class FingerprintController {
    constructor() {
        this.fingerprintService = new FingerprintService();
        this.firebaseService = new FirebaseService();
        this.statusElement = document.getElementById('status-message');
        this.scannerElement = document.getElementById('fingerprint-scanner');
        
        // Configura listeners para eventos do serviço de impressão digital
        document.addEventListener('fingerprintStatus', (event) => {
            this.updateStatus(event.detail.message);
        });
        
        document.addEventListener('fingerprintCaptured', (event) => {
            if (this.scannerElement) {
                this.scannerElement.classList.remove('scanning');
            }
        });
    }

    /**
     * Atualiza a mensagem de status na interface
     * @param {string} message - Mensagem a ser exibida
     * @param {string} type - Tipo de mensagem (info, success, error)
     */
    updateStatus(message, type = 'info') {
        if (this.statusElement) {
            this.statusElement.textContent = message;
            
            // Remove classes anteriores
            this.statusElement.classList.remove('text-success', 'text-danger', 'text-muted');
            
            // Adiciona classe conforme o tipo
            switch (type) {
                case 'success':
                    this.statusElement.classList.add('text-success');
                    break;
                case 'error':
                    this.statusElement.classList.add('text-danger');
                    break;
                default:
                    this.statusElement.classList.add('text-muted');
            }
        }
    }

    /**
     * Inicia o processo de captura de impressão digital
     * @returns {Promise} Promise com o template da digital capturada
     */
    async capturarDigital() {
        this.updateStatus('Posicione seu dedo no leitor...', 'info');
        
        if (this.scannerElement) {
            this.scannerElement.classList.add('scanning');
        }
        
        try {
            const template = await this.fingerprintService.captureFingerprint();
            
            if (!template) {
                throw new Error('Falha na captura da digital');
            }
            
            this.updateStatus('Digital capturada com sucesso!', 'success');
            return template;
        } catch (error) {
            this.updateStatus('Erro ao capturar digital: ' + error.message, 'error');
            throw error;
        } finally {
            if (this.scannerElement) {
                this.scannerElement.classList.remove('scanning');
            }
        }
    }

    /**
     * Cadastra um novo funcionário com impressão digital
     * @param {Object} dadosFuncionario - Dados do funcionário a ser cadastrado
     * @returns {Promise} Promise com o resultado do cadastro
     */
    async cadastrarFuncionario(dadosFuncionario) {
        try {
            this.updateStatus('Iniciando cadastro de nova digital...', 'info');
            
            // Captura a digital
            const digitalTemplate = await this.capturarDigital();
            
            // Solicita confirmação com nova captura
            this.updateStatus('Por favor, posicione o dedo novamente para confirmar...', 'info');
            
            // Aguarda um momento para a nova captura
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            try {
                const confirmacaoTemplate = await this.capturarDigital();
                
                // Verifica se as duas capturas são compatíveis
                const verificacao = this.fingerprintService.compareFingerprints(
                    digitalTemplate, 
                    confirmacaoTemplate
                );
                
                if (!verificacao.matched) {
                    this.updateStatus('As digitais não correspondem. Tente novamente.', 'error');
                    return {
                        success: false,
                        error: 'As digitais capturadas não correspondem. Tente novamente.'
                    };
                }
                
                // Cadastra o funcionário no Firebase
                const funcionarioId = await this.firebaseService.cadastrarFuncionario(
                    dadosFuncionario,
                    digitalTemplate
                );
                
                this.updateStatus('Funcionário cadastrado com sucesso!', 'success');
                
                return {
                    success: true,
                    funcionarioId,
                    mensagem: 'Funcionário cadastrado com sucesso!'
                };
            } catch (error) {
                this.updateStatus('Erro na confirmação: ' + error.message, 'error');
                throw error;
            }
            
        } catch (error) {
            this.updateStatus('Erro no cadastro: ' + error.message, 'error');
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Realiza a autenticação de um funcionário pela digital
     * @returns {Promise} Promise com o resultado da autenticação
     */
    async autenticarFuncionario() {
        try {
            this.updateStatus('Posicione seu dedo para autenticação...', 'info');
            
            // Captura a digital
            const digitalTemplate = await this.capturarDigital();
            
            // Busca funcionário no Firebase por correspondência exata
            let funcionario = await this.firebaseService.buscarFuncionarioPorDigitalExata(digitalTemplate.raw);
            
            if (!funcionario) {
                // Se não encontrar correspondência exata, tenta verificar com todos os funcionários
                const resultado = await this.verificarDigitalComTodos(digitalTemplate);
                
                if (resultado.success && resultado.funcionario) {
                    funcionario = resultado.funcionario;
                } else {
                    this.updateStatus('Digital não reconhecida.', 'error');
                    return {
                        success: false,
                        mensagem: 'Digital não reconhecida'
                    };
                }
            }
            
            // Registra o ponto
            const registro = await this.firebaseService.registrarPonto(
                funcionario.id,
                funcionario
            );
            
            this.updateStatus(`Autenticação bem-sucedida! Bem-vindo, ${funcionario.nome}`, 'success');
            
            return {
                success: true,
                funcionario,
                registro,
                mensagem: `Ponto registrado com sucesso! Tipo: ${registro.tipo}`
            };
            
        } catch (error) {
            this.updateStatus('Erro na autenticação: ' + error.message, 'error');
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Verifica a digital capturada com todos os funcionários cadastrados
     * @param {Object} digitalTemplate - Template da digital capturada
     * @returns {Promise} Promise com o resultado da verificação
     */
    async verificarDigitalComTodos(digitalTemplate) {
        try {
            // Obtém todos os funcionários ativos
            const funcionarios = await this.firebaseService.buscarTodosFuncionariosAtivos();
                
            if (!funcionarios || funcionarios.length === 0) {
                return { 
                    success: false, 
                    mensagem: 'Nenhum funcionário cadastrado' 
                };
            }
            
            // Verifica a digital com cada funcionário
            for (const funcionario of funcionarios) {
                // Verifica se o funcionário tem digital cadastrada
                if (!funcionario.digital || !funcionario.digital.dados) {
                    continue;
                }
                
                // Cria um objeto de template para comparação
                const funcionarioTemplate = {
                    format: funcionario.digital.formato,
                    raw: funcionario.digital.dados
                };
                
                // Verifica a digital
                const verificacao = this.fingerprintService.compareFingerprints(
                    digitalTemplate,
                    funcionarioTemplate
                );
                
                if (verificacao.matched) {
                    return {
                        success: true,
                        funcionario,
                        score: verificacao.score
                    };
                }
            }
            
            return { 
                success: false, 
                mensagem: 'Digital não corresponde a nenhum funcionário' 
            };
        } catch (error) {
            console.error('Erro ao verificar digital com todos:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }
}