const express = require('express');
const cors = require('cors');
const mysql = require('mysql');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const ejs = require('ejs');
const db = mysql.createConnection({
    host: 'eu-cdbr-west-03.cleardb.net',
    user: 'b3f8b85c8998c9',
    password: '157229c6',
    database: 'heroku_e027712250de33c',
    //port: 8889
});
const PORT = 8890
//mysql://b3f8b85c8998c9:157229c6@eu-cdbr-west-03.cleardb.net/heroku_e027712250de33c?reconnect=true
const checkTokenMiddleware = require('./check');
const paypal = require('@paypal/checkout-server-sdk');
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
const payPalClient = new paypal.core.PayPalHttpClient(
  //LIVE  
  new paypal.core.LiveEnvironment('AWjlTwG3OaW5_HKENvhJRL-6Bv-c9Tl9jOpCNq9pTIDzMN9sz73Y3hqWdq-INn4ydVqfxHiMGie6QHQs', 'EG36EzueGq407O3aNM6fBoV13JEvkopaPo5TEU7JhxjyZD-tZyR1_vyBKSzVw7H6W8gVQFiwaseuh8UU')
  //SANDBOX
  //new paypal.core.SandboxEnvironment('ARHAQlWzPGzXADFSjuvlG_KERv14IdT8cM--wFSwlAOZ6nmGH-sEOhq8iuNHBrkwPiSz4MBLGwwZDg1A', 'ECjh-fkIFrLfkPrWQecf0qLb5XiXCGDpIURHhtMmWQYOmjfdl9CLerxw7DRFn1BJMPgvUgEaUT0SEvUB')
);
app.use(cors({
    origin: ['https://diasporaevents-3781f.web.app', 
             'https://diasporaevents-3781f.web.app/home', 
             'https://diasporaevents-3781f.web.app/login',
             'https://diasporaevents-03872cd5beb2.herokuapp.com/api/event/add-event']
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
                        }, `${process.env.JWT_SECRET}`,{expiresIn: '1h'})
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
                    html: '<br><p> Cliquez <a href="https://diasporaevents-3781f.web.app/init-password">ici</a> pour re-initialiser votre mot de passe.</p>'
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
        if(result) {
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
    const {userId, eventId, statut, createdAt, nombreInvite, paymentId} = req.body;
    const query = `INSERT INTO userReservation (userId, eventId, statut, reservedAt, nombreInvite, paymentId) VALUES (?,?,?,?,?,?)`;
    const values = [userId, eventId, statut, createdAt, nombreInvite, paymentId];
    db.query(query, values, (err, result) => {
        if(result) {
            const query = `select * from evenement join user on user.userId = evenement.userId where eventId = ${eventId}`;
            db.query(query, (err, resp) => {
                //console.log(resp);
                if(!err) {
                    let option = {
                        from: 'notifications@diasporaevents.com',
                        to: resp[0].email,
                        subject: 'Félicitations! Nouvelle réservation',
                        html: '<br><div style="text-align: center;font-weight: 700;background: lightgray;padding: 2em">Bonjour '+ resp[0].filiation+', <br>Votre évènement ' +'<h1 style="color: green">'+resp[0].titre+'</h1>' + ' vient d\'avoir une nouvelle réservation.</div>'
                    }
                    transporter.sendMail(option).then(() => {
                        res.send({msg: 'tik'});
                    }).catch(err => {
                        res.send({msg: 'error'})
                    })
                }
            })

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
    const query = `select * from userReservation join user on userReservation.userId = user.userId where userReservationId = ${id}`;
    db.query(query, (err, result) => {
        if(result) {
            result.forEach(resu => {
                if(resu.paymentId === '0000') {
                    const query = `DELETE from userReservation where userReservationId = ${id}`;
                    db.query(query, (err, result) => {
                    if(!err) {
                        res.send({msg: 'nik'})
                    }else {
                        res.send({msg: 'no'})
                    }
                })
                } else {
                    const query = `select * from evenement where eventId = ${resu.eventId}`;
                    db.query(query, (err, val) => {
                        if(!val) {
                            console.log(val);
                            res.send({msg: 'moer'});
                        } else {
                            let option = {
                                from: 'notifications@diasporaevents.com',
                                to: resu.email,
                                subject: 'Réservation annulée',
                                html: '<br><div style="text-align: center;font-weight: 700;background: lightgray;padding: 2em">Bonjour '+ resu.filiation+', <br>Vous avez annulé votre réservation. <br>Nous avons procédé au remboursement de '+val[0].prix+'€ vers votre compte.</div>'
                            }
                            transporter.sendMail(option).then(() => {
                                const request = new paypal.payments.CapturesRefundRequest(resu.paymentId);
                                // Set the refund request body
                                request.requestBody({
                                    amount: {
                                        value: val[0].prix,
                                        currency_code: 'USD'
                                      }
                                });
                                // Call the PayPal API to process the refund
                                payPalClient.execute(request);
                                const  query = `DELETE FROM userReservation where userReservationId = ${id}`;
                                db.query(query, (err, r) => {
                                    if(!err) {
                                        res.send({msg: 'ok'});
                                    }
                                })
                            }).catch(err => {
                                res.send({msg: 'error'})
                            });
                        }
                    })
                    
                                  
                              
                        }
            })
        } else {
                
        }
    })
    
});

/* Annuler un évènement*/
app.get('/api/cancel-event/:id', (req, res) => {
    const id = req.params.id;
    const query = `select * from userReservation join user on user.userId = userReservation.userId where eventId = ${id}`;
    db.query(query, (err, result) => {
        if(!err) {
            if(result.length > 0) {
                result.forEach(resu => {
                    if(resu.paymentId === '0000') {
                        const query = `select * from evenement where eventId = ${resu.eventId}`;
                        //const values = [resu];
                        db.query(query, (err, resp) => {
                            if(!err) {
                                const query = `DELETE from evenement where eventId = ${id}`;
                                db.query(query, (err, re) => {
                                    if(!err) {

                                        //console.log(resp);
                                        let option = {
                                            from: 'notifications@diasporaevents.com',
                                            to: resu.email,
                                            subject: 'Votre évènement est annulé',
                                            html: '<div style="text-align: center;font-weight: 700;background: lightgray;padding: 2em">Bonjour '+ resu.filiation+', <br>Votre évènement ' +'<h1 style="color: green">'+resp[0].titre+'</h1>' + ' vient d\'être annulé par l\'organisateur. <br>Désolé pour la gêne occasionnée.</div>'
                                    }
                                    transporter.sendMail(option).then(() => {

                                        const  query = `DELETE FROM userReservation where eventId = ${id}`;
                                        db.query(query, (err, r) => {
                                            if(!err) {
                                                res.send({msg: 'ok'});
                                            }
                                        })
                                        }).catch(err => {
                                        res.send({msg: 'error'})
                                        });
                                    }
                                })

                            }
                        })
                    } else {

                    const request = new paypal.payments.CapturesRefundRequest(resu.paymentId);

                    // Set the refund request body
                    request.requestBody({});

                    // Call the PayPal API to process the refund
                    payPalClient.execute(request);
                    //console.log(response);
                    // Handle the refund response and update your database or perform other necessary actions

                    //res.status(200).json({ message: 'Refund processed successfully', response });
                    const query = `select * from evenement where eventId = ${resu.eventId}`;
                    //const values = [resu];
                    db.query(query, (err, resp) => {
                        if(!err) {
                            const query = `DELETE from evenement where eventId = ${id}`;
                            db.query(query, (err, re) => {
                                if(!err) {
                                    const  query = `DELETE FROM userReservation where eventId = ${id}`;
                                    db.query(query, (err, r) => {
                                        if(!err) {
                                            res.send({msg: 'ok'});
                                        }
                                    })
                                    //console.log(resp);
                                    let option = {
                                        from: 'notifications@diasporaevents.com',
                                        to: resu.email,
                                        subject: 'Votre évènement est annulé',
                                        html: '<br><div style="text-align: center;font-weight: 700;background: lightgray;padding: 2em">Bonjour '+ resu.filiation+', <br>Votre évènement ' +'<h1 style="color: green">'+resp[0].titre+'</h1>' + ' vient d\'être annulé par l\'organisateur. <br>Nous avons procédé au remboursement de votre paiement. <br>Désolé pour la gêne occasionnée.</div>'
                                    }
                                    transporter.sendMail(option).then(() => {
                                    }).catch(err => {
                                        res.send({msg: 'error'})
                                    });
                                }
                            })

                        }
                    })

                }
                })
            } else {
                const  query = `DELETE FROM evenement where eventId = ${id}`;
                db.query(query, (err, r) => {
                    if(!err) {
                        res.send({msg: 'ok'});
                    }
                })
            }
        }
    })
    //const query = `DELETE from evenement where eventId = ${id}`;

});

// Refund endpoint
app.post('/api/refund', async (req, res) => {
    try {
        const { orderId } = req.body;

        // Create a new PayPal refund request
        const request = new paypal.payments.CapturesRefundRequest(orderId);

        // Set the refund request body
        request.requestBody({});

        // Call the PayPal API to process the refund
        const response = await payPalClient.execute(request);

        // Handle the refund response and update your database or perform other necessary actions

        res.status(200).json({ msg: 'Ref', response });
    } catch (error) {
        //console.error(error);
        res.status(500).json({ error: error});
    }
});

/* Archiver un évènement*/
app.post('/api/archive-event', (req, res) => {
    const query = `INSERT INTO archivedEvent (eventId, userId, titre, lieu, dateStart, dateEnd, hourStart, hourEnd, codePostal, ville, image, description, prix, place, statut) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const {eventId, userId, titre, lieu, dateStart, dateEnd, hourStart, hourEnd, codePostal, ville, image, description, prix, place, statut} = req.body;
    const values = [eventId, userId, titre, lieu, new Date(dateStart), new Date(dateEnd), hourStart, hourEnd, codePostal, ville, image, description, prix, place, statut];
    db.query(query, values, (err, result) => {
        if(result) {
            const query = `DELETE FROM evenement WHERE eventId = ${eventId}`;
            db.query(query, (err, resu) => {
                if(!err) {
                    res.send({msg: 'in'});
                }
            })
        
        } else {
            res.send({msg: err});
        }
    })
})

/*Me contacter */
app.post('/api/contact', (req, res) => {
    const {filiation, objet, email, message} = req.body;
    let option = {
        from: email,
        to: 'diasporaeventsdevlinkor@gmail.com',
        subject: objet,
        html: '<div style="text-align: center;font-weight: 700;background: lightgray;padding: 2em">Bonjour, je m\'appelle '+ filiation + '<br>' + message +'</div>'
        }
    transporter.sendMail(option).then(() => {
        res.send({msg: 'se'});
    }).catch(err => {
    res.send({msg: 'error'})
    });
})
app.listen(process.env.PORT || 8890 , () => {
    console.log(`server is running on port `+ process.env.PORT);
})
