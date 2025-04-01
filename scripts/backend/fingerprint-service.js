/**
 * Serviço de gerenciamento de impressões digitais
 * Integra o scanner Digital Persona para captura de digitais
 */
class FingerprintService {
    constructor() {
        this.fingerprintSdk = null;
        this.currentFormat = Fingerprint.SampleFormat.PngImage;
        this.acquisitionStarted = false;
        this.currentCallback = null;
        this.selectedReader = "";
        this.initializeSDK();
    }

    /**
     * Inicializa o SDK do Digital Persona
     */
    initializeSDK() {
        try {
            // Inicializa o SDK do Digital Persona
            this.fingerprintSdk = new FingerprintSdkTest();
            
            // Enumera os leitores disponíveis
            this.enumerateReaders();
        } catch (error) {
            console.error("Erro ao inicializar SDK:", error);
            this.notifyStatusChange("Erro ao inicializar o leitor biométrico");
        }
    }

    /**
     * Enumera os leitores disponíveis
     */
    enumerateReaders() {
        this.fingerprintSdk.getInfo()
            .then((devices) => {
                console.log("Leitores disponíveis:", devices);
                if (devices && devices.length > 0) {
                    this.selectedReader = devices[0]; // Seleciona o primeiro leitor por padrão
                    this.notifyStatusChange("Leitor selecionado: " + this.selectedReader);
                } else {
                    this.notifyStatusChange("Nenhum leitor biométrico encontrado. Conecte um dispositivo.");
                }
            })
            .catch((error) => {
                console.error("Erro ao enumerar dispositivos:", error);
                this.notifyStatusChange("Erro ao detectar leitores biométricos.");
            });
    }

    /**
     * Notifica mudanças de status para os listeners
     */
    notifyStatusChange(message) {
        console.log("Status:", message);
        // Emite evento para que o controlador possa atualizar a UI
        const event = new CustomEvent('fingerprintStatus', { 
            detail: { message: message } 
        });
        document.dispatchEvent(event);
    }

    /**
     * Captura uma impressão digital
     * @returns {Promise} Promise que resolve com o template da digital capturada
     */
    captureFingerprint() {
        return new Promise((resolve, reject) => {
            // Limpa qualquer imagem anterior
            localStorage.setItem("imageSrc", "");
            localStorage.setItem("raw", "");
            localStorage.setItem("wsq", "");
            localStorage.setItem("intermediate", "");
            
            // Configura o formato para PNG
            currentFormat = Fingerprint.SampleFormat.PngImage;
            
            // Configura o callback para ser chamado quando a amostra for adquirida
            const originalSampleAcquired = window.sampleAcquired;
            
            window.sampleAcquired = (s) => {
                // Chama a função original primeiro
                originalSampleAcquired(s);
                
                // Após processar a amostra, resolve a promise com os dados
                if (localStorage.getItem("imageSrc")) {
                    const template = {
                        format: 'PNG',
                        data: localStorage.getItem("imageSrc"),
                        raw: JSON.parse(s.samples)[0]
                    };
                    
                    // Emite evento de captura concluída
                    const event = new CustomEvent('fingerprintCaptured', { 
                        detail: { template: template } 
                    });
                    document.dispatchEvent(event);
                    
                    // Para a captura
                    this.fingerprintSdk.stopCapture();
                    
                    // Resolve a promise
                    resolve(template);
                    
                    // Restaura a função original
                    window.sampleAcquired = originalSampleAcquired;
                }
            };
            
            // Inicia a captura
            this.notifyStatusChange("Posicione seu dedo no leitor...");
            
            try {
                // Inicia a captura
                this.fingerprintSdk.startCapture();
                
                // Define um timeout para a operação
                setTimeout(() => {
                    // Restaura a função original
                    window.sampleAcquired = originalSampleAcquired;
                    
                    // Para a captura se ainda estiver em andamento
                    this.fingerprintSdk.stopCapture();
                    
                    // Se não resolveu até agora, rejeita com timeout
                    reject(new Error("Tempo esgotado para captura da digital"));
                }, 15000); // 15 segundos para timeout
            } catch (error) {
                // Restaura a função original em caso de erro
                window.sampleAcquired = originalSampleAcquired;
                
                console.error("Erro ao iniciar captura:", error);
                reject(error);
            }
        });
    }

    /**
     * Compara duas impressões digitais
     * @param {Object} template1 - Primeiro template
     * @param {Object} template2 - Segundo template
     * @returns {Object} Resultado da comparação
     */
    compareFingerprints(template1, template2) {
        // Implementação simplificada de comparação de digitais
        if (!template1 || !template2) {
            return { matched: false, score: 0 };
        }
        
        // Compara os dados brutos das digitais
        if (template1.raw === template2.raw) {
            return { matched: true, score: 100 };
        }
        
        // Implementação de um algoritmo simples de similaridade
        // Converte base64 para array de bytes e compara
        const bytes1 = this.base64ToArrayBuffer(template1.raw);
        const bytes2 = this.base64ToArrayBuffer(template2.raw);
        
        const minLength = Math.min(bytes1.length, bytes2.length);
        let matchingBytes = 0;
        
        for (let i = 0; i < minLength; i++) {
            // Conta bytes correspondentes com uma tolerância
            if (Math.abs(bytes1[i] - bytes2[i]) <= 5) {
                matchingBytes++;
            }
        }
        
        const score = (matchingBytes / minLength) * 100;
        return { 
            matched: score > 70, // Considera match se score > 70%
            score: score 
        };
    }
    
    /**
     * Converte string base64 para ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
}