$ErrorActionPreference = 'Stop'

function Invoke-D1Read([string]$Sql) {
  for ($attempt = 1; $attempt -le 4; $attempt++) {
    $raw = & npx wrangler d1 execute qrstack-db-live --remote --command $Sql --json
    try {
      if (-not $raw) { throw 'empty response' }
      $parsed = $raw | Out-String | ConvertFrom-Json
      $root = if ($parsed -is [array]) { $parsed[0] } else { $parsed }
      if (-not $root.success -or $null -eq $root.results) { throw 'unexpected response' }
      return $root.results
    } catch {
      if ($attempt -eq 4) { throw "D1 read failed after $attempt attempts: $($_.Exception.Message)" }
      Start-Sleep -Milliseconds (400 * $attempt)
    }
  }
}

$rows = @(Invoke-D1Read "SELECT m.id, m.restaurant_id, m.date, m.title, m.price, m.service_hours, m.story_link, m.notes, m.is_published, m.published_at, m.created_at, m.updated_at, json_group_array(json_object('id',i.id,'menu_day_id',i.menu_day_id,'name',i.name,'category',i.category,'description',i.description,'price',i.price,'image_url',i.image_url,'is_highlight',i.is_highlight,'sort_order',i.sort_order,'created_at',i.created_at)) AS items_json FROM menu_days m LEFT JOIN menu_items i ON i.menu_day_id=m.id WHERE m.restaurant_id='rest_amaro' GROUP BY m.id ORDER BY m.date DESC")
$menus = @($rows | ForEach-Object {
  $copy = $_ | Select-Object * -ExcludeProperty items_json
  $copy
})
$items = @($rows | ForEach-Object { @($_.items_json | ConvertFrom-Json) })

if ($menus.Count -ne 10) { throw "Expected 10 D1 menus, found $($menus.Count)" }
if ($items.Count -ne 70) { throw "Expected 70 D1 menu items, found $($items.Count)" }

$records = @($menus | ForEach-Object {
  $menu = $_
  $row = $rows | Where-Object { $_.id -eq $menu.id } | Select-Object -First 1
  $menuItems = @($row.items_json | ConvertFrom-Json)
  if ($menuItems.Count -ne 7) { throw "Menu $($menu.id) has $($menuItems.Count) items; seed aborted" }
  [ordered]@{
    restaurant = [ordered]@{ id = 'rest_amaro'; slug = 'amaro'; name = 'Amaro Café' }
    menu = $menu
    items = $menuItems
    response_source = 'd1'
    response_id = "d1:$($menu.id)"
    received_at = if ($menu.updated_at) { $menu.updated_at } else { $menu.created_at }
  }
})

$body = @{
  action = 'cacheMenuRecords'
  key = 'qrstack-berna-2026'
  records = $records
} | ConvertTo-Json -Depth 12 -Compress

$response = Invoke-RestMethod -Method Post -Uri 'https://qrstack-api.qrstack.workers.dev' -ContentType 'text/plain;charset=UTF-8' -Body $body
if (-not $response.ok -or $response.cached -ne $records.Count) { throw "Cache seed rejected: $($response | ConvertTo-Json -Compress)" }

[ordered]@{ menus_read = $menus.Count; items_read = $items.Count; kv_cached = $response.cached } | ConvertTo-Json -Compress
