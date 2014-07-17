<?php

  define('CARTO_DB_APIKEY', '7a21536f8d4e92fae1a647e6bf47355b95d49df3');
  $url = 'http://danielbeeke.cartodb.com/api/v2/sql?q=';

  $most_recent_date_query = 'SELECT date FROM misdaad ORDER BY date DESC LIMIT 1';

  $recent_date_result = json_Decode(file_get_contents($url . urlencode($most_recent_date_query)), TRUE);

  $last_date = strtotime($recent_date_result['rows'][0]['date']);

  $json = json_decode(file_get_contents('http://www.politie.nl/getCMData.json'), TRUE);

  if (!$json) {
    print 'no json';
    return;
  }

  print 'last date: ' . $last_date . "\n";

  $values = array();

  foreach($json as $location) {
    $location_timestamp = strtotime($location['data']['datum']);
    $location_date = date('m-d-Y', $location_timestamp);

    print 'current date: ' . $location_date . "\n";

    if ($location_timestamp > $last_date) {
      $values[] = urlencode('(ST_GeomFromText(\'POINT(' . $location['lng'] . ' ' . $location['lat'] . ')\', 4326),' .
      '\'' . $location['data']['categorie'] . '\',' .
      $location['data']['categorieId'] . ',' .
      '\'' . $location_date . '\',' .
      '\'' . $location['data']['postcode'] . '\'' .
      ')');
    }
  }

  $chunks = array_chunk($values, 40);

  foreach ($chunks as $index => $chunk) {
    $query = urlencode('INSERT INTO misdaad ' .
    '(the_geom, category, categoryId, date, postal_code) ' .
    'VALUES ') . implode(',', $chunk);

    $api = $url . $query . '&api_key=' . CARTO_DB_APIKEY;

    file_get_contents($api);

    print $index . " done. \n\n";
  }
