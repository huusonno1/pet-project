package com.coupleapp.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class ExpoPushSenderTest {

    static final String URL = "https://exp.host/--/api/v2/push/send";

    @Test
    void mapsTicketsToResultsInOrder() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        ExpoPushSender sender = new ExpoPushSender(builder, URL);

        server.expect(requestTo(URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$[0].to").value("ExponentPushToken[a]"))
                .andExpect(jsonPath("$[0].data.url").value("coupleapp://moments/1"))
                .andExpect(jsonPath("$[1].sound").value("default"))
                .andRespond(withSuccess("""
                        {"data":[
                          {"status":"ok","id":"t1"},
                          {"status":"error","message":"not registered","details":{"error":"DeviceNotRegistered"}}
                        ]}""", MediaType.APPLICATION_JSON));

        List<PushResult> results = sender.send(List.of(
                PushMessage.of("ExponentPushToken[a]", "Tiêu đề", "Nội dung", "coupleapp://moments/1"),
                PushMessage.of("ExponentPushToken[b]", "Tiêu đề", "Nội dung", null)));

        assertThat(results).containsExactly(PushResult.success(), PushResult.failure("DeviceNotRegistered"));
        server.verify();
    }
}
