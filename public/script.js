let currentNome = null;

async function checkStatus() {
    try {
        const data = await pegarUsuarioAtual();
        const statusElement = document.getElementById('status')
        statusElement.textContent = `Autenticado como: ${data.nome}`;
        statusElement.style.color = 'green';
        currentNome = data.nome;
        document.getElementById('profileNome').value = data.nome;
        document.getElementById('profileEmail').value = data.email;
        document.getElementById('profileDescricao').value = data.descricao || '';
        showAuthenticated();
    } catch {
        const statusElement = document.getElementById('status');
        statusElement.textContent = 'Não autenticado';
        statusElement.style.color = 'red';
        showUnauthenticated();
    }
}

function showAuthenticated() {
    document.getElementById('signup').style.display = 'none';
    document.getElementById('login').style.display = 'none';
    document.getElementById('profile').style.display = 'block';
    document.getElementById('cadastros').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'inline-block';
}

function showUnauthenticated() {
    document.getElementById('signup').style.display = 'block';
    document.getElementById('login').style.display = 'block';
    document.getElementById('profile').style.display = 'none';
    document.getElementById('cadastros').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
}

// As funções retornam uma Promise então para receber o resultado delas é usado o "await", ex: await login(nome, senha); 

// Função para cadastro
// Colocarn nome, email e senha para o cadastro ser criado, caso não seja efetuado retornará uma mensagem com o erro
async function cadastrar(nome, email, senha) {
    const res = await fetch('/api/cadastros/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nome, email, senha })
    });
    const data = await res.json();
    return data;
}

// Função para login
// Colocar o nome e a senha do cadastro, se estiverem corretos o login será feito, caso contrário retornará uma mensagem com o erro
async function login(nome, senha) {
    const res = await fetch('/api/cadastros/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nome, senha })
    });
    const data = await res.json();
    return data;
}

// Função para atualizar perfil 
// Os campos do body são os campos que serão atualizados, ex: {nome: "Isaque"} atualiza o nome para isaque
async function atualizarPerfil(body) {
    const res = await fetch(`/api/cadastros/${encodeURIComponent(currentNome)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
    });
    const data = await res.json();
    return data;
}
// Função para pegar lista de cadastros
// Retorna um objeto com cada Cadastro
async function pegarCadastros() {
    const res = await fetch('/api/cadastros', { credentials: 'include' });
    const data = await res.json();
    return data;
}

// Função para pegar as informações do login atual
// Retorna um objeto com as informações
async function pegarUsuarioAtual() {
    const res = await fetch('/api/auth', { credentials: 'include' });
    if (!res.ok) throw new Error();
    const data = await res.json();
    return data;
}
// Função para deletar um cadastro 
// Colocar nome e senha do cadastro a ser deletado
async function deletarCadastro(nome, senha) {
    const res = await fetch("/api/cadastros", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, senha }),
    });
    const data = await res.json();
    return data;
}
// Funcões popup padrões
function showPopup(popupId, mensagemPopup) {
    document.getElementById(popupId).querySelector('p').textContent = mensagemPopup;
    document.getElementById(popupId).classList.add('show');
    document.getElementById('popupOverlay').classList.add('show');
}

function closePopup(popupId) {
    document.getElementById(popupId).classList.remove('show');
    document.getElementById('popupOverlay').classList.remove('show');
}

document.getElementById('signupBtn').addEventListener('click', async () => { // Cadastrar
    const nome = document.getElementById('signupNome').value;
    const email = document.getElementById('signupEmail').value;
    const senha = document.getElementById('signupSenha').value;

    const data = await cadastrar(nome, email, senha);
    showPopup('Popup', data.result || data.message);
    if (data.success) checkStatus(); // Se deu certo, atualiza a página
});

document.getElementById('loginBtn').addEventListener('click', async () => { // Fazer login
    const nome = document.getElementById('loginNome').value;
    const senha = document.getElementById('loginSenha').value;

    const data = await login(nome, senha);
    showPopup('Popup', data.result || data.message);
    if (data.success) checkStatus();
});

document.getElementById('logoutBtn').addEventListener('click', async () => { // Logout
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    checkStatus();
});

document.getElementById('updateBtn').addEventListener('click', async () => { // Atualizar perfil
    const nome = document.getElementById('profileNome').value;
    const email = document.getElementById('profileEmail').value;
    const senha = document.getElementById('profileSenha').value;
    const descricao = document.getElementById('profileDescricao').value;
    const body = { nome, email, descricao };
    if (senha) body.senha = senha;

    const data = await atualizarPerfil(body);
    showPopup('PopupTempo', data.result || data.message);
    if (data.success){
        setTimeout(() => {window.location.reload();}, 3000);
    } 
});

document.getElementById('deleteBtn').addEventListener('click', () => {
    showPopup('popupCancelamento'); // Mostra o novo popup de confirmação
});

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    closePopup('confirmDeletePopup'); // fecha o popup de confirmação

    const userAtual = await pegarUsuarioAtual();
    const data = await deletarCadastro(userAtual.nome, userAtual.senha);

    showPopup('PopupTempo', data.result || data.message); // mostra resultado

    if (data.success) {
        setTimeout(() => {
            window.location.reload();
        }, 3000);
    }
});

document.getElementById('listBtn').addEventListener('click', async () => { // Lista de cadastros
    const data = await pegarCadastros();
    const ul = document.getElementById('cadastroList');
    ul.innerHTML = '';
    if (data.success && Array.isArray(data.result)) {
        data.result.forEach(u => {
            const li = document.createElement('li');
            li.textContent = `${u.nome} - Descrição: ${u.descricao || '(Sem descrição)'}`;
            ul.appendChild(li);
        });
    }
});

// Inicializa
checkStatus();
