# PS WiFi Monitor v3 - instant connect/disconnect detection
# Monitors WiFi registration table for PS devices and sends webhooks.
# Uses ip-bindings (ps-bypass:*) as the source of PS MAC addresses.
# Deployed via scheduler every 5 seconds on MikroTik RouterOS 7.x.
#
# State format: "MAC1=1;MAC2=0;" where 1=connected, 0=disconnected
# Updates state BEFORE firing webhooks to prevent re-detection on slow fetch.

:global psMonState
:if ([:typeof $psMonState] != "str") do={ :set psMonState "" }

:local url "http://192.168.1.100:3000/api/playstation/webhook"
:local newState ""
:local connects ""
:local disconnects ""

# Build current state and detect changes
:foreach b in=[/ip/hotspot/ip-binding find comment~"ps-bypass:"] do={
  :local mac [/ip/hotspot/ip-binding get $b mac-address]
  :local regs [/interface/wifi/registration-table find mac-address=$mac]
  :local up "0"
  :if ([:len $regs] > 0) do={ :set up "1" }
  :set newState ($newState . $mac . "=" . $up . ";")
  :if ($up = "1" && [:typeof [:find $psMonState ($mac . "=1")]] != "num") do={
    :set connects ($connects . $mac . ",")
  }
  :if ($up = "0" && [:typeof [:find $psMonState ($mac . "=1")]] = "num") do={
    :set disconnects ($disconnects . $mac . ",")
  }
}

# Update state BEFORE firing webhooks (prevents re-detection if fetch blocks)
:set psMonState $newState

# Fire webhooks for changes
:foreach b in=[/ip/hotspot/ip-binding find comment~"ps-bypass:"] do={
  :local mac [/ip/hotspot/ip-binding get $b mac-address]
  :if ([:typeof [:find $connects $mac]] = "num") do={
    :log info ("PS-Monitor: " . $mac . " connected")
    :do { /tool/fetch http-method=post keep-result=no url=($url . "\?mac=" . $mac . "&action=connect") } on-error={}
  }
  :if ([:typeof [:find $disconnects $mac]] = "num") do={
    :log info ("PS-Monitor: " . $mac . " disconnected")
    :do { /tool/fetch http-method=post keep-result=no url=($url . "\?mac=" . $mac . "&action=disconnect") } on-error={}
  }
}
