import React from 'react'
import { Route } from 'react-router-dom'
import Personal from './personal/Personal'
import MixStudio from './mix/MixStudio'

const routes = [
  <Route exact path="/mixes" render={() => <MixStudio />} key={'mixes'} />,
  <Route exact path="/personal" render={() => <Personal />} key={'personal'} />,
]

export default routes
