use crate::{AiInterfaceEndpoint, DeploymentHandshake, ExecutorHealthSnapshot, ModelInvocationRequest};
use serde::de::DeserializeOwned;
use serde_json::{json, Value};
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

pub struct ExecutorHandler {
    connect_timeout: Duration,
    read_timeout: Duration,
}

impl ExecutorHandler {
    pub fn new() -> Self {
        Self {
            connect_timeout: Duration::from_secs(3),
            read_timeout: Duration::from_secs(15),
        }
    }

    pub fn health(&self, endpoint: AiInterfaceEndpoint) -> Value {
        match self.get_json::<ExecutorHealthSnapshot>(&endpoint, "/health") {
            Ok(snapshot) => serde_json::to_value(snapshot)
                .unwrap_or_else(|error| json!({ "error": error.to_string() })),
            Err(error) => error,
        }
    }

    pub fn handshake(&self, endpoint: AiInterfaceEndpoint) -> Value {
        match self.get_json::<DeploymentHandshake>(&endpoint, "/handshake") {
            Ok(handshake) => serde_json::to_value(handshake)
                .unwrap_or_else(|error| json!({ "error": error.to_string() })),
            Err(error) => error,
        }
    }

    pub fn invoke(&self, endpoint: AiInterfaceEndpoint, request: ModelInvocationRequest) -> Value {
        let body = match serde_json::to_vec(&request) {
            Ok(body) => body,
            Err(error) => return json!({ "error": error.to_string() }),
        };

        match self.send_request(&endpoint, "POST", "/model/invoke", Some(&body)) {
            Ok(response) => match response.into_value() {
                Ok(value) => value,
                Err(error) => json!({ "error": error }),
            },
            Err(error) => json!({ "error": error }),
        }
    }

    fn get_json<T: DeserializeOwned>(
        &self,
        endpoint: &AiInterfaceEndpoint,
        path: &str,
    ) -> Result<T, Value> {
        let response = self
            .send_request(endpoint, "GET", path, None)
            .map_err(|error| json!({ "error": error }))?;

        if response.status >= 400 {
            return Err(response.error_value());
        }

        serde_json::from_slice::<T>(&response.body)
            .map_err(|error| json!({ "error": error.to_string(), "path": path }))
    }

    fn send_request(
        &self,
        endpoint: &AiInterfaceEndpoint,
        method: &str,
        path: &str,
        body: Option<&[u8]>,
    ) -> Result<HttpResponse, String> {
        let address = (endpoint.host.as_str(), endpoint.port)
            .to_socket_addrs()
            .map_err(|error| error.to_string())?
            .next()
            .ok_or_else(|| format!("unable to resolve {}:{}", endpoint.host, endpoint.port))?;

        let mut stream = TcpStream::connect_timeout(&address, self.connect_timeout)
            .map_err(|error| error.to_string())?;
        stream
            .set_read_timeout(Some(self.read_timeout))
            .map_err(|error| error.to_string())?;
        stream
            .set_write_timeout(Some(self.read_timeout))
            .map_err(|error| error.to_string())?;

        let payload = body.unwrap_or(&[]);
        let content_headers = if body.is_some() {
            format!(
                "Content-Type: application/json\r\nContent-Length: {}\r\n",
                payload.len()
            )
        } else {
            String::new()
        };
        let request = format!(
            "{method} {path} HTTP/1.1\r\nHost: {host}:{port}\r\nAccept: application/json\r\nConnection: close\r\n{content_headers}\r\n",
            host = endpoint.host,
            port = endpoint.port,
        );

        stream
            .write_all(request.as_bytes())
            .map_err(|error| error.to_string())?;
        if body.is_some() {
            stream.write_all(payload).map_err(|error| error.to_string())?;
        }
        stream.flush().map_err(|error| error.to_string())?;

        let mut response = Vec::new();
        stream
            .read_to_end(&mut response)
            .map_err(|error| error.to_string())?;

        HttpResponse::parse(&response)
    }
}

struct HttpResponse {
    status: u16,
    body: Vec<u8>,
}

impl HttpResponse {
    fn parse(response: &[u8]) -> Result<Self, String> {
        let separator = b"\r\n\r\n";
        let boundary = response
            .windows(separator.len())
            .position(|window| window == separator)
            .ok_or_else(|| "invalid http response".to_string())?;
        let (head, rest) = response.split_at(boundary);
        let body = rest[separator.len()..].to_vec();
        let head_text = String::from_utf8_lossy(head);
        let status_line = head_text
            .lines()
            .next()
            .ok_or_else(|| "missing status line".to_string())?;
        let status = status_line
            .split_whitespace()
            .nth(1)
            .ok_or_else(|| "missing http status".to_string())?
            .parse::<u16>()
            .map_err(|error| error.to_string())?;

        Ok(Self { status, body })
    }

    fn into_value(self) -> Result<Value, String> {
        if self.status >= 400 {
            return Ok(self.error_value());
        }

        serde_json::from_slice::<Value>(&self.body).map_err(|error| error.to_string())
    }

    fn error_value(&self) -> Value {
        match serde_json::from_slice::<Value>(&self.body) {
            Ok(Value::Object(mut object)) => {
                object.insert("http_status".into(), json!(self.status));
                Value::Object(object)
            }
            Ok(other) => json!({ "http_status": self.status, "body": other }),
            Err(_) => json!({
                "http_status": self.status,
                "error": String::from_utf8_lossy(&self.body).to_string(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::ExecutorHandler;
    use crate::{AiInterfaceEndpoint, AiInterfaceTransport, ModelInvocationRequest};
    use serde_json::json;
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::thread;
    use std::time::Duration;

    #[test]
    fn health_request_reads_executor_payload() {
        let (endpoint, handle) = spawn_server(|request| {
            assert!(request.starts_with("GET /health HTTP/1.1"));
            http_response(
                200,
                json!({
                    "label": "runpod-executor",
                    "status": "healthy",
                    "roles": ["DeploymentExecutor", "ValidationWorker"],
                    "network_path": "ControlledPublicGateway",
                    "workspace": "/workspace",
                    "available_disk_gb": 12,
                    "available_memory_mb": 512,
                    "model_backend": { "configured": false, "reachable": false }
                })
                .to_string(),
            )
        });

        let response = ExecutorHandler::new().health(endpoint);
        handle.join().unwrap();

        assert_eq!(response["label"], "runpod-executor");
        assert_eq!(response["status"], "healthy");
    }

    #[test]
    fn invoke_request_posts_model_payload() {
        let (endpoint, handle) = spawn_server(|request| {
            assert!(request.starts_with("POST /model/invoke HTTP/1.1"));
            assert!(request.contains("\"prompt\":\"hello butterfly\""));
            http_response(200, json!({ "output": "ok" }).to_string())
        });

        let response = ExecutorHandler::new().invoke(
            endpoint,
            ModelInvocationRequest::new("hello butterfly"),
        );
        handle.join().unwrap();

        assert_eq!(response["output"], "ok");
    }

    #[test]
    fn invoke_surfaces_http_errors() {
        let (endpoint, handle) = spawn_server(|request| {
            assert!(request.starts_with("POST /model/invoke HTTP/1.1"));
            http_response(
                503,
                json!({ "error": "BUTTERFLY_MODEL_BACKEND_URL is not configured" }).to_string(),
            )
        });

        let response = ExecutorHandler::new().invoke(
            endpoint,
            ModelInvocationRequest::new("hello butterfly"),
        );
        handle.join().unwrap();

        assert_eq!(response["http_status"], 503);
    }

    fn spawn_server<F>(responder: F) -> (AiInterfaceEndpoint, thread::JoinHandle<()>)
    where
        F: FnOnce(String) -> String + Send + 'static,
    {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let request = read_request(&mut stream);
            let response = responder(request);
            stream.write_all(response.as_bytes()).unwrap();
            stream.flush().unwrap();
        });

        (
            AiInterfaceEndpoint {
                host: "127.0.0.1".into(),
                port,
                transport: AiInterfaceTransport::DirectLoopback,
            },
            handle,
        )
    }

    fn read_request(stream: &mut TcpStream) -> String {
        stream.set_read_timeout(Some(Duration::from_secs(1))).unwrap();
        let mut request = Vec::new();
        let mut buffer = [0_u8; 1024];

        loop {
            match stream.read(&mut buffer) {
                Ok(0) => break,
                Ok(read) => {
                    request.extend_from_slice(&buffer[..read]);
                    if request.windows(4).any(|window| window == b"\r\n\r\n") {
                        let request_text = String::from_utf8_lossy(&request);
                        let content_length = request_text
                            .lines()
                            .find_map(|line| {
                                line.strip_prefix("Content-Length: ")
                                    .and_then(|value| value.trim().parse::<usize>().ok())
                            })
                            .unwrap_or(0);

                        if let Some(boundary) = request.windows(4).position(|window| window == b"\r\n\r\n") {
                            let body_start = boundary + 4;
                            if request.len() >= body_start + content_length {
                                break;
                            }
                        }
                    }
                }
                Err(error)
                    if error.kind() == std::io::ErrorKind::WouldBlock
                        || error.kind() == std::io::ErrorKind::TimedOut =>
                {
                    break;
                }
                Err(error) => panic!("failed to read request: {error}"),
            }
        }

        String::from_utf8(request).unwrap()
    }

    fn http_response(status: u16, body: String) -> String {
        format!(
            "HTTP/1.1 {status} OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len(),
        )
    }
}