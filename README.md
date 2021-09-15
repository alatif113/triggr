# Triggr

Triggr is a Splunk application that allows you to chain multiple saved searches together, while only scheduling the first search in the chain. This is especially useful when sequential transformations are required for data within lookup tables or KV stores. 

## Usage

1. Click the **"Add Search"** button to add searches into the editor. 
2. Click and drag the the output of one search node into the input of another. 
3. Click **Save Changes** to save your changes and enable chaining of searches.  

### Considersations

1. The first search in the chain must be scheduled in order for any subsequent searches to be dispatched. 
2. If an error occurs in a search, no subsequent searches in the chain are dispatched.
3. The graphical editor does not imply any "AND" or "OR" operations. The connection between search nodes simply implies that after the previous search successfully completes, all subsquent searches will attempt to be dispatched. 
4. Splunk user permissions apply. A user will not be able to chain searches he/she does not have permissions to edit.  

## Support

This app is currently unsupported for Internet Explorer.

## Third-Party Components

### Rete.js

MIT License
Copyright (c) 2018 "Ni55aN" Vitaliy Stoliarov
https://raw.githubusercontent.com/retejs/rete/master/LICENSE

## Vue

The MIT License (MIT)
Copyright (c) 2013-present, Yuxi (Evan) You
https://raw.githubusercontent.com/vuejs/vue/dev/LICENSE

## klayjs

Eclipse Public License - v 1.0
https://raw.githubusercontent.com/kieler/klayjs/master/LICENSE