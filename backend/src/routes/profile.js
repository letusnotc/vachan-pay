const router = require('express').Router();
const Joi    = require('joi');
const auth   = require('../middleware/auth');
const { getProfile, upsertProfile, getBalance } = require('../controllers/profileController');

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
  next();
};

const profileSchema = Joi.object({
  name:  Joi.string().min(1).max(100).trim().required(),
  email: Joi.string().email().allow('', null).optional()
});

router.use(auth);

router.get('/',        getProfile);
router.post('/',       validate(profileSchema), upsertProfile);
router.get('/balance', getBalance);

module.exports = router;
