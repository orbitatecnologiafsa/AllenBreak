/**
 * Serviço para gerenciamento de dados no Firebase
 */
class FirebaseService {
    constructor() {
        this.db = firebase.firestore();
    }

    /**
     * Cadastra um novo funcionário com impressão digital
     * @param {Object} funcionario - Dados do funcionário
     * @param {Object} digitalTemplate - Template da impressão digital
     * @returns {Promise} Promise com o ID do funcionário cadastrado
     */
    async cadastrarFuncionario(funcionario, digitalTemplate) {
        try {
            // Verifica se já existe um funcionário com esta digital
            const existente = await this.buscarFuncionarioPorDigitalExata(digitalTemplate.raw);
            if (existente) {
                throw new Error('Já existe um funcionário cadastrado com esta impressão digital');
            }

            // Adiciona o funcionário ao Firestore
            const docRef = await this.db.collection('funcionarios').add({
                nome: funcionario.nome,
                cargo: funcionario.cargo,
                departamento: funcionario.departamento,
                email: funcionario.email,
                digital: {
                    formato: digitalTemplate.format,
                    dados: digitalTemplate.raw, // Armazena os dados brutos da digital
                    dataCadastro: firebase.firestore.FieldValue.serverTimestamp()
                },
                dataCadastro: firebase.firestore.FieldValue.serverTimestamp(),
                ativo: true
            });

            console.log('Funcionário cadastrado com ID:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Erro ao cadastrar funcionário:', error);
            throw error;
        }
    }

    /**
     * Busca um funcionário pelo template exato da digital
     * @param {string} digitalRaw - Dados brutos da impressão digital
     * @returns {Promise<Object|null>} Dados do funcionário ou null se não encontrado
     */
    async buscarFuncionarioPorDigitalExata(digitalRaw) {
        try {
            const snapshot = await this.db.collection('funcionarios')
                .where('digital.dados', '==', digitalRaw)
                .where('ativo', '==', true)
                .limit(1)
                .get();

            if (snapshot.empty) {
                return null;
            }

            const doc = snapshot.docs[0];
            return {
                id: doc.id,
                ...doc.data()
            };
        } catch (error) {
            console.error('Erro ao buscar funcionário por digital exata:', error);
            throw error;
        }
    }

    /**
     * Busca todos os funcionários ativos
     * @returns {Promise<Array>} Lista de funcionários
     */
    async buscarTodosFuncionariosAtivos() {
        try {
            const snapshot = await this.db.collection('funcionarios')
                .where('ativo', '==', true)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Erro ao buscar todos os funcionários:', error);
            throw error;
        }
    }

    /**
     * Registra um ponto para um funcionário
     * @param {string} funcionarioId - ID do funcionário
     * @param {Object} dadosFuncionario - Dados do funcionário
     * @returns {Promise} Promise com o ID do registro
     */
    async registrarPonto(funcionarioId, dadosFuncionario) {
        try {
            const agora = new Date();
            
            // Determina o tipo de registro (entrada ou saída)
            const tipoRegistro = await this.determinarTipoRegistro(funcionarioId);
            
            // Adiciona o registro ao Firestore
            const docRef = await this.db.collection('registros').add({
                funcionarioId: funcionarioId,
                nome: dadosFuncionario.nome,
                tipo: tipoRegistro,
                horario: agora,
                data: agora.toLocaleDateString('pt-BR'),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('Ponto registrado com ID:', docRef.id);
            return {
                id: docRef.id,
                tipo: tipoRegistro,
                horario: agora
            };
        } catch (error) {
            console.error('Erro ao registrar ponto:', error);
            throw error;
        }
    }

    /**
     * Determina se o registro atual é de entrada ou saída
     * @param {string} funcionarioId - ID do funcionário
     * @returns {Promise<string>} "entrada" ou "saída"
     */
    async determinarTipoRegistro(funcionarioId) {
        try {
            // Busca o último registro do funcionário no dia atual
            const hoje = new Date();
            const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
            
            const snapshot = await this.db.collection('registros')
                .where('funcionarioId', '==', funcionarioId)
                .where('horario', '>=', inicioHoje)
                .orderBy('horario', 'desc')
                .limit(1)
                .get();

            if (snapshot.empty) {
                return "entrada";
            }

            const ultimoRegistro = snapshot.docs[0].data();
            return ultimoRegistro.tipo === "entrada" ? "saída" : "entrada";
        } catch (error) {
            console.error('Erro ao determinar tipo de registro:', error);
            // Em caso de erro, assume entrada como padrão
            return "entrada";
        }
    }

    /**
     * Obtém o histórico de registros de um funcionário
     * @param {string} funcionarioId - ID do funcionário
     * @param {Date} dataInicio - Data de início do período
     * @param {Date} dataFim - Data de fim do período
     * @returns {Promise<Array>} Lista de registros
     */
    async obterHistoricoRegistros(funcionarioId, dataInicio, dataFim) {
        try {
            const snapshot = await this.db.collection('registros')
                .where('funcionarioId', '==', funcionarioId)
                .where('horario', '>=', dataInicio)
                .where('horario', '<=', dataFim)
                .orderBy('horario', 'asc')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Erro ao obter histórico de registros:', error);
            throw error;
        }
    }
}