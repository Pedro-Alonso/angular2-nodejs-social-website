const Users = require('../datasets/users');
import * as bcrypt from 'bcryptjs';
import {Request, Response} from 'express'
import * as multer from 'multer';
import * as fs from 'fs-extra';

const storage = multer.diskStorage({ // multers disk storage settings
  destination: function (req: any, file, cb) {
    const dir = './src/assets/upload/' + req.body.userId;
    if (!fs.existsSync(dir)) {
      console.log('le path n\'existe pas lors de la creation demulter', dir);
      fs.mkdir(dir, err => {
        cb(err, dir);
      });
    } else {
      cb(null, dir);
    }
  },
  filename: function (req, file, cb: any) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    const datetimestamp = Date.now();
    cb(null, file.fieldname + '-' + datetimestamp + '.' + file.originalname.split('.')[file.originalname.split('.').length - 1]);
  }
});

const upload = multer({ // multer settings
  storage: storage
}).single('file');

export class ProfileController {
  public io;

  constructor(io) {
    this.io = io
  }

  /**
   *
   * @param req
   * @param res
   */
  updatePhoto = (req, res: Response) => {
    upload(req, res, function (err) {
      console.log('req.file', req.file);
      if (err) {
        res.json({error_code: 1, err_desc: err});
      }
      const userId = req.body.userId;
      Users.findById(userId)
        .select({password: 0, __v: 0})
        .exec(function (err, userData) {
          const user = userData;
          user[req.body.uploadType] = req.file.path.substr(4);
          user.save(function (err) {
            if (err) {
              console.log('failed save');
              res.status(500).send(err + 'error uploading image');
            } else {
              console.log('save successful', userData);
              res.json(user);
            }
          });
        });
    });
  }

  /**
   * update any type of DataValue
   * @param {Express.Request} req
   * @param {string} req.body.userId -mongoose userId
   * @param {Object} req.body -the userId plus the key you want to change
   * @param {Response} res
   */
  updateChamp = (req, res) => {
    const userId = req.body.userId;
    console.log(req.body);
    const champ = Object.keys(req.body).filter(elem => elem !== 'userId').toString();
    if (champ === 'email') {
      req.assert('email', 'Email is not valid').isEmail();
      req.assert('email', 'Email cannot be blank').notEmpty();
      req.sanitize('email').normalizeEmail({remove_dots: false});
      const errors = req.validationErrors();
      if (errors) {
        return res.status(400).send(errors);
      }
    }
    const value = req.body[champ];
    Users
      .findById(userId)
      .select({password: 0, __v: 0})
      .exec((err, userData) => {
        const user = userData;
        user[champ] = [value];
        user.save(error => {
          if (error) {
            console.log('fail');
            res.json({status: 500});
          } else {
            console.log('champ sauvegardé ' + champ);
            res.json(user);
          }
        });
      });
  };

  /**
   * Update password Put request
   * @param req
   * @param {string} req.body.userId
   * @param res
   */
  updatePassword = (req, res) => {
    req.assert('lastPassword', 'Password must be at least 4 characters long').len(4);
    req.assert('password', 'Password must be at least 4 characters long').len(4);
    const errors = req.validationErrors();
    if (errors) {
      return res.status(400).send(errors);
    }
    const userId = req.body.userId, password = req.body.password;
    Users.findById(userId, function (err, user) {
      user.comparePassword(req.body.lastPassword, function (err, isMatch) {
          if (isMatch) {
            user.password = bcrypt.hashSync(password);
            user.save(() => {
              res.json({msg: 'password update from the server'});
            });
          } else {
            res.status(401).send(err);
          }
        }
      );
    });
  }

  // TODO be sure that is functionning
  /**
   *
   * @param req
   * @param res
   */
  deleteAccount = (req, res) => {
    const id = req.params.id;
    Users.update({'following.userId': id}, {$pull: {following: {userId: id}}}, {multi: true}, (err, numberAffect) => {
      if (err) {
        res.status(404).json('cannot find the account');
      } else {
        Users.findByIdAndRemove(id, (error) => {
          if (!error) {
            res.send(`Your account has been deleted, number of friend affected : ${numberAffect}`);
          } else {
            res.status(404).json('cannot find the account');
          }
        });
      }
    });
  }
}
