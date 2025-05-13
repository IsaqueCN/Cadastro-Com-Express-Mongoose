const Express = require("express")
const Cadastro = require("./Cadastro")

let router = Express.Router();

// Gerencia os erros de UNQIUE
function uniqueErrorHandler(err) {
    if (err.code == 11000) {
        if (err.keyPattern?.nome)
            return "O nome já está em uso."
        else if (err.keyPattern?.email)
            return "O email já está em uso."
    }
}

// Gerencia erros de validação, retorna as mensagens do erro mapeadas para uma array
function validationErrorHandler(err) {
    if (err.name == "ValidationError")
        return Object.values(err.errors).map(e => e.message)
}

function authLock(req, res, next)  { // Middleware que não permite que o usuário acesse a rota caso não esteja autenticado
    if (!req.session.objectID) {
        return res.status(401).json({"success": false, "message": "Sem autorização."})
    }
    next();
}

router.get("/", async (req, res) => {
    let result = await Cadastro.find({}, { email: 0, senha: 0, __v: 0 })
    res.status(200).json({ "success": true, "result": result })
})

router.get("/relatorio", async (req, res) => {
    try {
        const [report] = await Cadastro.aggregate([
            {
                $facet: {
                    totalCadastros: [
                        { $count: "count" }
                    ],
                    emailsPorDominio: [
                        {
                            $group: {
                                _id: { $arrayElemAt: [ { $split: ["$email", "@"] }, 1 ] },
                                quantidade: { $sum: 1 }
                            }
                        },
                        { $project: { dominio: "$_id", quantidade: 1, _id: 0 } }
                    ],
                    mediaTamanhoDescricao: [
                        { $match: { descricao: { $exists: true, $ne: null } } },
                        { $project: { tamanho: { $strLenCP: "$descricao" } } },
                        {
                            $group: {
                                _id: null,
                                media: { $avg: "$tamanho" }
                            }
                        },
                        { $project: { _id: 0, media: 1 } }
                    ],
                    usuariosComImagem: [
                        {
                            $group: {
                                _id: {
                                    $cond: [
                                        { $or: [
                                            { $eq: [{ $ifNull: ["$imageURL", null] }, null] },
                                            { $eq: ["$imageURL", ""] }
                                        ] },
                                        "semImagem",
                                        "comImagem"
                                    ]
                                },
                                count: { $sum: 1 }
                            }
                        },
                        { $project: { categoria: "$_id", count: 1, _id: 0 } }
                    ],
                    datasCadastro: [
                        {
                            $group: {
                                _id: null,
                                earliest: { $min: { $toDate: "$_id" } },
                                latest: { $max: { $toDate: "$_id" } }
                            }
                        },
                        { $project: { _id: 0, earliest: 1, latest: 1 } }
                    ],
                    nomesOrdenados: [
                        { $project: { _id: 0, nome: 1 } },
                        { $sort: { nome: 1 } }
                    ]
                }
            }
        ])

        const resultado = {
            totalCadastros: report.totalCadastros[0]?.count ?? 0,
            emailsPorDominio: report.emailsPorDominio,
            mediaTamanhoDescricao: report.mediaTamanhoDescricao[0]?.media ?? 0,
            usuariosComImagem: report.usuariosComImagem.reduce(
                (acc, cur) => ({ ...acc, [cur.categoria]: cur.count }), {}
            ),
            earliestCadastro: report.datasCadastro[0]?.earliest || null,
            latestCadastro: report.datasCadastro[0]?.latest || null,
            nomesOrdenados: report.nomesOrdenados.map(c => c.nome)
        }

        res.status(200).json({ success: true, result: resultado })
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Erro ao gerar relatório\n" + err.message
        })
    }
})

router.get("/:nome", async (req, res) => {
    let result = await Cadastro.find({nome: req.params.nome}, {email: 0, senha: 0, __v: 0});
    if (result.length == 0)
        return res.status(400).json({"success": false, "message": "Cadastro não encontrado."});

    res.status(200).json({"success": true, "result": result});
})

router.post("/", async (req, res) => { // Quando alguem registrar
    try {
        let result = await Cadastro.insertOne(req.body);
        req.session.objectID = result._id
        res.status(200).json({ "success": true, "result": result })
    } catch (err) {
        res.status(400).json({ "success": false, "message": uniqueErrorHandler(err) || validationErrorHandler(err) || err })
    }
})

router.post("/login", async (req, res) => { // Quando alguem fazer login
    try {
        if (!req.body || (!req.body.nome && !req.body.email) || !req.body.senha)
            return res.status(400).json({"success": false, "message": "Os campos 'nome' e 'senha' são obrigatórios."});

        let result = await Cadastro.find(req.body);
        if (result.length == 0)
            return res.status(400).json({"success": false, "message": "Credenciais inválidas."});

        req.session.objectID = result[0]._id;
        res.status(200).json({"success": true, "result": "Login bem sucedido."});
    } catch (err) {
        res.status(400).json({"success": false, "message": err.message});
    }
})

router.delete("/", async (req, res) => {
    try {
        if (!req.body || !req.body.nome || !req.body.senha)
            return res.status(400).json({ "success": false, "message": "Campos 'nome' e 'senha' são obrigatórios" })

        let result = await Cadastro.deleteOne(req.body);
        if (result.deletedCount == 0) // Não removeu nada
            return res.status(400).json({"success": false, "message": "Cadastro não encontrado."})
        
        res.status(200).json({ "success": true, "result": "Cadastro removido com sucesso." })
    } catch (err) {
        res.status(400).json({ "success": false, "message": err.message })
    }
})

router.put("/", (req, res) => {
    return res.status(400).json({"success": false, "message": "Parametro 'nome' é obrigatório. (Ex /cadastros/nomeAqui)"})
})

router.put("/:nome", authLock, async (req, res) => {
    try {
        let login = await Cadastro.findById(req.session.objectID);
        if (!login || login.nome.toLowerCase() != req.params.nome.toLowerCase()) // Permite apenas o propietário da conta alterar ela
            return res.status(400).json({"success": false, "message": "Sem autorização."});

        let result = await Cadastro.updateOne({nome: req.params.nome}, req.body, {runValidators: true})
        
        if (!result.acknowledged)
            return res.status(400).json({"success": false, "message": "Campos incorretos, verifique o nome dos campos."})
        else if (result.matchedCount == 0)
            return res.status(400).json({"success": false, "message": "Cadastro não encontrado."})

        res.status(200).json({"success": true, "result": "Cadastro atualizado com sucesso."})
    } catch (err) {
        res.status(400).json({"success": false, "message": uniqueErrorHandler(err) || validationErrorHandler(err) || err})
    }
})

module.exports = router;
