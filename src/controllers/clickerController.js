exports.getGame = (req, res) => {
  if (typeof req.session.counter !== 'number') req.session.counter = 0;
  res.render('clicker', { title: 'Clicker Game', score: req.session.counter });
};

exports.click = (req, res) => {
  if (typeof req.session.counter !== 'number') req.session.counter = 0;
  req.session.counter += 1;
  res.redirect('/Clicker');
}; 