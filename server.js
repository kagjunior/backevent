const express = require('express');
const cors = require('cors');
const mysql = require('mysql');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const ejs = require('ejs');
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'events'
});
const checkTokenMiddleware = require('./check');
db.connect(function (error) {
    if(error) {
        console.log('erreur de connexion à la base')
    }
    else {
        console.log('Connexion réussie')
    };
});
const nodemailer = require('nodemailer');
//econst mailGen = require('mailgen');
const Mailgen = require("mailgen");
const app = express();
const NodeCache = require('node-cache');
const {hash} = require("bcrypt");
const codeCache = new NodeCache();
const config = {
    service: 'gmail',
    auth: {
        user: 'diasporaevents62@gmail.com',
        pass: 'iyvbepntrbdnuiwp',
        //method: 'LOGIN'
    },
    secure: true,
}
const transporter = nodemailer.createTransport(config);
app.use(cors({
    origin: 'http://localhost:4200'
}));
app.use(express.json());
app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: true}));

app.get('/api/', (req,res) => res.send('Je marche!'));
//app.get('*', (req,res) => res.status(501).send('Mais tu fais quoi ?'));

// Login
app.post('/api/login', (req, res) => {
    const id = req.body.email;
    // console.log(id);
    const query = `SELECT * FROM user WHERE email = '${id}'`;
    db.query(query, (err, result) => {
        // res.send({message: result[0].password});
        if(result.length === 0) {
            res.send({message: 'error'});
        } else {
            if(result[0].valid === 0) {
                res.status(200).send({msg: 'lid'})
            } else {
                const password = req.body.password;
                console.log(password);
                bcrypt.compare(password, result[0].password, (err, resu) => {
                    if(resu) {
                        // jwt
                        const token = jwt.sign({
                            id: result[0].userId,
                            filiation: result[0].filiation,
                            email: result[0].email,
                            codePostal: result[0].codePostal,
                            adresse: result[0].adresse,
                            ville: result[0].ville,
                            telephone: result[0].telephone
                        }, process.env.JWT_SECRET,{expiresIn: '1h'})
                        res.send({access_token: token});
                    } else {
                        res.send({message: 'wordError'});
                    }
                })
            }
        }
    })
});

/* Mot de passe oublié */
app.post('/api/forgotPassword', (req,res) => {
    const email = req.body.email;
    const query = `SELECT * FROM user WHERE email = '${email}'`;
    db.query(query, (err, result) => {
        if(!err) {
            if(result.length <= 0) {
                res.send({msg: 'notCompte'})
            } else {
                let option = {
                    from: 'diasporaevents62@gmail.com',
                    to: result[0].email,
                    subject: 'Votre mot de passe oublié',
                    html: '<br><p> Cliquez <a href="http://localhost:4200/init-password">ici</a> pour re-initialiser votre mot de passe.</p>'
                }
                transporter.sendMail(option).then(() => {
                    res.send({id: result[0].userId})
                }).catch(err => {
                    res.send({msg: 'error'})
                })
            }
        }
    })
})

/* get password forgotted*/
app.post('/api/new-password', (req, res) => {
    const {id, password} = req.body;
    bcrypt.hash(password, 10, (err, hash) => {
        if(!err) {
            const query = `UPDATE user SET password = '${hash}' WHERE userId = ${id}`;
            db.query(query, (error, result) => {
                if(!error) {
                    res.send({msg: 'top'})
                }else {
                    res.send({msg: 'err'});
                }
            })
        }
    })

})

// S'inscrire
app.post('/api/sign-up', (req, res) => {
    const email = req.body.email;
    const min = 100000;
    const max = 999999;
    const code = Math.floor(Math.random() * (max - min + 1)) + min;
    let mailGenerator = new Mailgen({
        theme: 'default',
        product: {
            name: 'Code de vérification',
            link: 'https://mailgen.js'
        }
    });
    let response = {
        body: {
            name: 'Diaspora Events',
            intro: 'Votre code de vérification est : '+code
        }
    };
    let mail = mailGenerator.generate(response);
    let message = {
        from: 'diasporaevents62@gmail.com',
        to: email,
        subject: 'Code à valider',
        html: mail
    };
    const query = `SELECT * FROM user WHERE email = '${email}'`;
    db.query(query, (err, result) => {
        if(result.length > 0) {
            res.status(200).send({message: 'exist'});
        } else {
            const {filiation, email, password, codePostal, ville, adresse, telephone} = req.body;
            bcrypt.hash(password, 10, (err,hash) => {
                if(err) {
                    res.status(500).send({message: 'errorH'});
                } else {
                    const query = `INSERT INTO user (filiation, email, telephone, password, adresse, codePostal, ville, valid) VALUES (?,?,?,?,?,?,?,?)`;
                    const values = [filiation, email, telephone, hash, adresse, codePostal, ville, 0];
                    db.query(query, values, (err, result) => {
                        if(err) {
                            res.status(500).send({message: 'error'});
                        } else {
                            codeCache.set(email, code);
                            transporter.sendMail(message).then(() => {
                                return res.status(201).json({msg: 'code'});
                            }).catch(error => {
                                console.error(error);
                                return res.status(500).json({error})
                            });
                        }
                    })
                }
            });

        }
    })
});

/*  Vérification du code */
app.post('/api/verify-code', (req,res) => {
    const code = req.body.code;
    const email = req.body.email;
    //console.log(req.body);
    const storedCode = codeCache.get(email);
    //console.log(storedCode);
    if(code !== storedCode) {
        res.status(200).send({msg: 'notvalid'});
    } else {
        const query = `UPDATE user SET valid = 1 WHERE email = '${email}'`;
        db.query(query, (err, result) => {
            if(result) {
                res.status(200).send({msg: 'ok'});
            } else {
                res.status(500).send({msg: err});
            }
        })

    }
});

/* information d'un user*/
app.get('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    const query = `select filiation from user where userId = ${userId}`;
    db.query(query, (err, result) => {
        if(!err) {
            res.send(result);
        }
    })
})

/* ajouter event*/
app.post('/api/event/add-event', (req,res) => {
    const {userId, titre, lieu, dateStart, dateEnd, hourStart, hourEnd, codePostal, ville, image, description, prix, place, statut} = req.body;
    const query = `SELECT * FROM evenement WHERE userId = ${userId} ORDER BY eventId DESC LIMIT 1`;
    db.query(query, (err, result) => {
        if(result.length === 0 || result[0].statut === 1 || result[0].statut === -1) {
            const query = `INSERT INTO evenement (userId, titre, lieu, dateStart, dateEnd, hourStart, hourEnd, codePostal, ville, image, description, prix, place, statut) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
            const values = [userId, titre, lieu, dateStart, dateEnd, hourStart, hourEnd, codePostal, ville, image, description, prix, place, statut];
            db.query(query, values, (err,result) => {
                if(result) {
                    res.send({msg: 'add'});
                } else {
                    res.send({msg: err});
                }
            })
        } else {
            res.send({msg: 'notallowed'});
        }
    })
});

/* liste des events*/
app.get('/api/list-event', (req, res) => {
    const query = `SELECT * FROM evenement`;
    db.query(query, (err, result) => {
        if(result) {
            res.send(result);
        }
    })
});

/* detail event*/
app.get('/api/list-event/:id', (req,res) => {
    const id = req.params.id;
    const query = `SELECT * FROM evenement WHERE eventId = ${id}`;
    db.query(query, (err, result) => {
        if(result) {
            res.send(result);

        }
    })
});

/* Si j'ai déjà réservé ou pas*/
app.post('/api/check-reservation', (req, res) => {
    const {userId, eventId} = req.body;
    const query = `select * from userReservation where userId = ${userId} && eventId = ${eventId}`;
    db.query(query, (err, result) => {
        if(!err) {
            if (result.length === 0) {
                res.send({msg: 'notReserved'});
            } else {
                res.send({msg: 'reserved'});
            }
        } else  {
            res.send({msg: 'err'});
        }
    })
})

/* get event by user - évènement d'un user */
app.get('/api/user-event/:id', (req,res) => {
    const id = req.params.id;
    const query = `SELECT * FROM evenement WHERE userId = ${id}`;
    db.query(query, (err, result) => {
        if(result) {
            res.send(result);
        }
    })
});

/* je réserve ma place*/
app.post('/api/reservation', (req,res) => {
    const {userId, eventId, statut, createdAt, nombreInvite} = req.body;
    const query = `INSERT INTO userReservation (userId, eventId, statut, reservedAt, nombreInvite) VALUES (?,?,?,?,?)`;
    const values = [userId, eventId, statut, createdAt, nombreInvite];
    db.query(query, values, (err, result) => {
        if(result) {
            res.send({msg: 'tik'})
        } else {
            res.send({msg: err});
        }
    })
});

/* liste reservation d'un user*/
app.get('/api/list-reservation/:id', (req, res) => {
    const id = req.params.id;
    const query = `SELECT * FROM userReservation JOIN evenement ON userReservation.eventId = evenement.eventId WHERE userReservation.userId = ${id}`;
    db.query(query, (err, result) => {
        if(result) {
            res.send(result);
        } else {
            res.send(err);
        }
    })

});

/* total evenement réservé*/
app.get('/api/event-reservation/:id', (req, res) => {
    const id = req.params.id;
    const query = `SELECT SUM(nombreInvite) AS total FROM userReservation WHERE eventId = ${id}`;
    db.query(query, (err, result) => {
        if(result) {
            res.send(result);
        } else {
            res.send(err);
        }
    })

});

/* liste des réservations d'un event*/
app.get('/api/event/reservations/:id', (req,res) => {
    const eventId = req.params.id;
    const query = `select * from userReservation join user on user.userId = userReservation.userId where eventId = ${eventId}`;
    db.query(query, (err, result) => {
        if(!err) {
            res.send(result);
        }
    })
});

/* Annuler une réservation*/
app.get('/api/cancel-reservation/:id', (req, res) => {
    const id = req.params.id;
    const query = `DELETE from userReservation where userReservationId = ${id}`;
    db.query(query, (err, result) => {
        if(!err) {
            res.send({msg: 'nik'})
        }else {
            res.send({msg: 'no'})
        }
    })
});

/* Annuler un évènement*/
/* Annuler une réservation*/
app.get('/api/cancel-event/:id', (req, res) => {
    const id = req.params.id;
    const query = `DELETE from evenement where eventId = ${id}`;
    db.query(query, (err, result) => {
        if(!err) {
            res.send({msg: 'ok'})
        }else {
            res.send({msg: 'not'})
        }
    })
})

app.listen(process.env.SERVER_PORT, () => {
    console.log(`server is running on port ${process.env.SERVER_PORT}`);
})
